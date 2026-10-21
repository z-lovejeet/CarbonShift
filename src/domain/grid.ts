import { DomainError, parseDomain } from "./errors";
import { freezeDomain, METHOD } from "./method";
import { gridSnapshotFieldsSchema, gridSnapshotSchema, type GridSnapshotV1 } from "./schemas";
import { epochSeconds } from "./time";

/** Normalize validated provider-neutral data. Fetching/provenance trust belongs to M03. */
export function normalizeGridSnapshot(input: unknown): GridSnapshotV1 {
  const fields = parseDomain(gridSnapshotFieldsSchema, input, "INVALID_GRID_SNAPSHOT");
  fields.intervals.sort((a, b) => a.fromUtc.localeCompare(b.fromUtc));
  return freezeDomain(parseDomain(gridSnapshotSchema, fields, "INVALID_GRID_SNAPSHOT"));
}

export function assertForecastFreshness(snapshot: GridSnapshotV1, nowUtc: string): void {
  const age = epochSeconds(nowUtc) - epochSeconds(snapshot.retrievedAtUtc);
  if (age < 0) throw new DomainError("FUTURE_GRID_SNAPSHOT", "Grid retrieval cannot be in the future.");
  if (age > METHOD.maximumForecastAgeSeconds) throw new DomainError("STALE_GRID_SNAPSHOT", "Retrieve a fresh forecast before comparing or accepting.");
}

/** Required coverage includes blocks and unusable tail intervals, preventing selective optimization. */
export function requireForecastCoverage(snapshot: GridSnapshotV1, fromUtc: string, toUtc: string): void {
  const from = epochSeconds(fromUtc), to = epochSeconds(toUtc);
  const byStart = new Map(snapshot.intervals.map((interval) => [epochSeconds(interval.fromUtc), interval.forecastGPerKwh]));
  for (let instant = from; instant < to; instant += METHOD.intervalSeconds) {
    if (byStart.get(instant) == null) throw new DomainError("INCOMPLETE_GRID_COVERAGE", "Complete forecast factors are required for the entire planning window.");
  }
}
