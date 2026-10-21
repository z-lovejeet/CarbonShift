import { describe, expect, it } from "vitest";
import { buildGridRequest, parseNationalResponse } from "@/server/grid/provider";
import { FORECAST_RANGE, GRID_NOW, providerPayload } from "../fixtures/grid-provider";

const request = { ...FORECAST_RANGE, kind: "forecast" as const };
describe("M03.01 national requests and provider shape (T05)", () => {
  it("builds only fixed-origin national endpoints", () => {
    expect(buildGridRequest(request)).toMatchObject({ url: "https://api.carbonintensity.org.uk/intensity/2026-10-21T07:00Z/fw48h" });
    expect(buildGridRequest({ kind: "actual", fromUtc: "2026-10-21T07:15:00Z", toUtc: "2026-10-21T10:01:00Z" })).toMatchObject({ fromUtc: "2026-10-21T07:00:00Z", toUtc: "2026-10-21T10:30:00Z", url: "https://api.carbonintensity.org.uk/intensity/2026-10-21T07:00Z/2026-10-21T10:30Z" });
  });
  it.each([
    { ...request, url: "https://attacker.invalid" }, { ...request, geography: "IN" }, { ...request, kind: "regional" },
    { ...request, fromUtc: "https://attacker.invalid" }, { ...request, fromUtc: "2026-02-30T07:00:00Z" },
    { ...request, fromUtc: "2026-10-21T07:00Z" }, { ...request, fromUtc: "2026-10-21T07:01:00Z" },
    { ...request, toUtc: FORECAST_RANGE.fromUtc }, { ...request, toUtc: "2026-10-24T07:00:00Z" },
    { ...request, kind: "actual", toUtc: "2026-10-26T07:00:00Z" },
  ])("rejects unsupported request %j before network access", (input) => {
    expect(() => buildGridRequest(input)).toThrow(expect.objectContaining({ code: "INVALID_GRID_REQUEST" }));
  });
  it("normalizes minute/whole-second timestamps and discards unused additions", () => {
    const input = providerPayload(); input.data.reverse();
    const result = parseNationalResponse({ ...input, extra: "unused" }, request, GRID_NOW)!;
    expect(result.intervals[0]).toEqual({ fromUtc: "2026-10-21T07:00:00Z", toUtc: "2026-10-21T07:30:00Z", forecastGPerKwh: 300, actualGPerKwh: 300 });
    expect(result.providerIssuedAtUtc).toBeNull(); expect(result.retrievedAtUtc).toBe(GRID_NOW);
    expect(result.sourceUrl).toBe(buildGridRequest(request).url); expect(result.license).toBe("CC BY 4.0");
    expect(input.data[0]!.from).toBe("2026-10-21T10:30Z");
    expect(Object.isFrozen(result.intervals[0])).toBe(true);
    expect(parseNationalResponse({ data: [{ from: "2026-10-21T07:00:00Z", to: "2026-10-21T07:30:00Z", intensity: { forecast: 0, actual: null } }] }, request, GRID_NOW)!.intervals[0]!.actualGPerKwh).toBeNull();
  });
  it("keeps an empty series explicitly unavailable", () => { expect(parseNationalResponse({ data: [] }, request, GRID_NOW)).toBeNull(); });
});

describe("M03.02 interval validation (T05)", () => {
  it.each(["duplicate", "gap", "overlap", "length", "offset", "nonexistent", "missing_factor", "string", "negative", "decimal", "unsafe", "nonfinite", "regional"])("rejects invalid provider data: %s", (kind) => {
    const value = providerPayload();
    if (kind === "duplicate") value.data.push(value.data[0]!);
    if (kind === "gap") value.data.splice(2, 1);
    if (kind === "overlap") value.data[1]!.from = "2026-10-21T07:00Z";
    if (kind === "length") value.data[0]!.to = "2026-10-21T07:45Z";
    if (kind === "offset") value.data[0]!.from = "2026-10-21T08:00+01:00";
    if (kind === "nonexistent") value.data[0]!.from = "2026-02-30T07:00Z";
    if (kind === "missing_factor") delete (value.data[0]!.intensity as { actual?: number | null }).actual;
    if (kind === "negative") value.data[0]!.intensity.forecast = -1;
    if (kind === "decimal") value.data[0]!.intensity.forecast = 1.1;
    if (kind === "unsafe") value.data[0]!.intensity.forecast = Number.MAX_SAFE_INTEGER + 1;
    if (kind === "nonfinite") value.data[0]!.intensity.forecast = Infinity;
    const input = kind === "string" ? { data: [{ ...value.data[0], intensity: { forecast: "300", actual: null } }] } :
      kind === "regional" ? { data: [{ from: "2026-10-21T07:00Z", to: "2026-10-21T07:30Z", regions: [] }] } : value;
    expect(() => parseNationalResponse(input, request, GRID_NOW)).toThrow(expect.objectContaining({ code: "INVALID_GRID_RESPONSE" }));
  });
  it("rejects excessive rows while preserving explicit nulls", () => {
    expect(() => parseNationalResponse({ data: Array(257).fill(providerPayload().data[0]) }, request, GRID_NOW)).toThrow();
    const value = parseNationalResponse(providerPayload([null, 0]), request, GRID_NOW)!;
    expect(value.intervals.map((interval) => interval.forecastGPerKwh)).toEqual([null, 0]);
  });
});
