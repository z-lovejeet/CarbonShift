import { z } from "zod";
import { parseDomain } from "@/domain/errors";
import { normalizeGridSnapshot } from "@/domain/grid";
import { METHOD } from "@/domain/method";
import { utcInstantSchema, type GridSnapshotV1 } from "@/domain/schemas";
import { safeNonnegativeInteger } from "@/domain/schemas/primitives";
import { epochSeconds, utcFromSeconds } from "@/domain/time";
import { GridError } from "./errors";

export const GRID_POLICY = Object.freeze({
  origin: "https://api.carbonintensity.org.uk", license: "CC BY 4.0",
  attribution: "NESO Carbon Intensity API — CC BY 4.0; normalized by CarbonShift",
  cacheLifetimeMs: 300_000, maximumCacheEntries: 32,
  attemptTimeoutMs: 8_000, totalTimeoutMs: 20_000, retryDelayMs: 250,
  maximumRetryAfterMs: 2_000, maximumBodyBytes: 256 * 1024, maximumIntervals: 256,
  maximumActualRangeSeconds: 96 * 3600,
});

const requestSchema = z.strictObject({ kind: z.enum(["forecast", "actual"]), fromUtc: utcInstantSchema, toUtc: utcInstantSchema });
export type GridRange = { fromUtc: string; toUtc: string };
export type GridRequest = GridRange & { kind: "forecast" | "actual"; url: string; key: string };

export function parseGridRange(input: unknown): GridRange {
  const result = requestSchema.omit({ kind: true }).safeParse(input);
  if (!result.success) throw new GridError("INVALID_GRID_REQUEST", "Supply only the required UTC range fields.");
  return result.data;
}

export function buildGridRequest(input: unknown): GridRequest {
  const result = requestSchema.safeParse(input);
  if (!result.success) throw new GridError("INVALID_GRID_REQUEST", "Use a supported national grid range with canonical UTC bounds.");
  const value = result.data;
  const from = epochSeconds(value.fromUtc), to = epochSeconds(value.toUtc);
  if (from >= to || (value.kind === "forecast" && (from % METHOD.intervalSeconds !== 0 || to % METHOD.intervalSeconds !== 0))) {
    throw new GridError("INVALID_GRID_REQUEST", "Forecast bounds must be ordered UTC half-hours; actual bounds must be ordered.");
  }
  const fromUtc = utcFromSeconds(Math.floor(from / METHOD.intervalSeconds) * METHOD.intervalSeconds);
  const toUtc = utcFromSeconds(Math.ceil(to / METHOD.intervalSeconds) * METHOD.intervalSeconds);
  const span = epochSeconds(toUtc) - epochSeconds(fromUtc);
  if (span > (value.kind === "forecast" ? METHOD.horizonSeconds : GRID_POLICY.maximumActualRangeSeconds)) {
    throw new GridError("INVALID_GRID_REQUEST", "The requested grid range exceeds the supported horizon.");
  }
  const minute = (utc: string) => utc.replace(":00Z", "Z");
  const path = value.kind === "forecast" ? `${minute(fromUtc)}/fw48h` : `${minute(fromUtc)}/${minute(toUtc)}`;
  return Object.freeze({ kind: value.kind, fromUtc, toUtc, url: `${GRID_POLICY.origin}/intensity/${path}`, key: `${value.kind}|${fromUtc}|${toUtc}` });
}

const providerTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::00)?Z$/).transform((value) => value.length === 17 ? value.replace("Z", ":00Z") : value).pipe(utcInstantSchema);
// Strip unused provider fields; never coerce missing factors, strings or invalid units.
const providerResponseSchema = z.object({ data: z.array(z.object({
  from: providerTime, to: providerTime,
  intensity: z.object({ forecast: safeNonnegativeInteger.nullable(), actual: safeNonnegativeInteger.nullable() }),
})).max(GRID_POLICY.maximumIntervals) });

export function parseNationalResponse(input: unknown, requestInput: unknown, retrievedAtUtc: string): GridSnapshotV1 | null {
  // Reconstruct even internal requests, so provenance cannot contain an injected destination.
  const request = buildGridRequest(requestInput);
  const parsed = providerResponseSchema.safeParse(input);
  if (!parsed.success) throw new GridError("INVALID_GRID_RESPONSE", "The national grid response does not match the required data contract.");
  if (parsed.data.data.length === 0) return null;
  parseDomain(utcInstantSchema, retrievedAtUtc);
  try {
    return normalizeGridSnapshot({
      geography: METHOD.geography, sourceUrl: request.url, retrievedAtUtc,
      providerIssuedAtUtc: null, license: GRID_POLICY.license,
      intervals: parsed.data.data.map((interval) => ({ fromUtc: interval.from, toUtc: interval.to, forecastGPerKwh: interval.intensity.forecast, actualGPerKwh: interval.intensity.actual })),
    });
  } catch {
    throw new GridError("INVALID_GRID_RESPONSE", "Grid intervals must be valid, contiguous UTC half-hours without duplicates.");
  }
}
