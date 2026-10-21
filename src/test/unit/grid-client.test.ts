import { describe, expect, it, vi } from "vitest";
import { createGridClient } from "@/server/grid/client";
import { hashGridSnapshot } from "@/server/grid/snapshot";
import { createComparison } from "@/domain/scheduling";
import { calculateUpdatedResult } from "@/domain/results";
import { constraints, NOW, REPORT_ID } from "../fixtures/domain";
import { FORECAST_RANGE, providerPayload, providerResponse } from "../fixtures/grid-provider";

const clock = () => Date.parse(NOW);
describe("M03.01 typed grid client (T05)", () => {
  it("reads real-shaped forecast data into the unchanged scheduler contract", async () => {
    const fetcher = vi.fn(async () => providerResponse());
    const record = await createGridClient({ fetcher, nowMs: clock }).getForecast(FORECAST_RANGE);
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/); expect(record.hash).toBe(hashGridSnapshot(record.snapshot));
    expect(record.attribution).toContain("NESO");
    expect(fetcher).toHaveBeenCalledWith("https://api.carbonintensity.org.uk/intensity/2026-10-21T07:00Z/fw48h", expect.objectContaining({ cache: "no-store", redirect: "error", credentials: "omit" }));
    const comparison = createComparison({ constraints: constraints(), snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, NOW);
    expect(comparison.selected.estimatedMg).toBe(120000); expect(comparison.differenceMg).toBe(200000);
  });
  it("rejects invalid range before fetching", async () => {
    const fetcher = vi.fn(); const client = createGridClient({ fetcher, nowMs: clock });
    await expect(client.getForecast({ fromUtc: "https://attacker.invalid", toUtc: FORECAST_RANGE.toUtc })).rejects.toMatchObject({ code: "INVALID_GRID_REQUEST" });
    await expect(client.getActual({ fromUtc: "https://attacker.invalid", toUtc: FORECAST_RANGE.toUtc })).rejects.toMatchObject({ code: "INVALID_GRID_REQUEST" });
    const injected = { ...FORECAST_RANGE, kind: "actual", url: "https://attacker.invalid" };
    await expect(client.getForecast(injected)).rejects.toMatchObject({ code: "INVALID_GRID_REQUEST" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("returns actual-range snapshots and empty actual data honestly", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(providerResponse()).mockResolvedValueOnce(providerResponse({ data: [] }));
    const client = createGridClient({ fetcher, nowMs: clock });
    expect((await client.getActual(FORECAST_RANGE))!.snapshot.intervals).toHaveLength(8);
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.carbonintensity.org.uk/intensity/2026-10-21T07:00Z/2026-10-21T11:00Z");
    expect(await client.getActual({ ...FORECAST_RANGE, toUtc: "2026-10-21T12:00:00Z" })).toBeNull();
  });
});

describe("M03.02 requested coverage and null factors (T05)", () => {
  it.each(["first", "last", "null", "empty"])("rejects incomplete forecast: %s", async (kind) => {
    const value = providerPayload();
    if (kind === "first") value.data.shift(); if (kind === "last") value.data.pop();
    if (kind === "null") value.data[3]!.intensity.forecast = null; if (kind === "empty") value.data = [];
    const client = createGridClient({ fetcher: async () => providerResponse(value), nowMs: clock });
    await expect(client.getForecast(FORECAST_RANGE)).rejects.toMatchObject({ code: "INCOMPLETE_GRID_COVERAGE" });
  });
  it("retains extra surrounding intervals rather than assuming a row count", async () => {
    const value = providerPayload();
    value.data.unshift({ from: "2026-10-21T06:30Z", to: "2026-10-21T07:00Z", intensity: { forecast: 100, actual: null, index: "authored" } });
    const record = await createGridClient({ fetcher: async () => providerResponse(value), nowMs: clock }).getForecast(FORECAST_RANGE);
    expect(record.snapshot.intervals).toHaveLength(9);
  });
  it("allows partial actual edges and passes missingness to the updated calculator", async () => {
    const forecast = await createGridClient({ fetcher: async () => providerResponse(), nowMs: clock }).getForecast(FORECAST_RANGE);
    const comparison = createComparison({ constraints: constraints(), snapshot: forecast.snapshot, forecastSnapshotId: forecast.id, forecastSnapshotHash: forecast.hash }, NOW);
    const partial = providerPayload(); partial.data.shift();
    const actual = await createGridClient({ fetcher: async () => providerResponse(partial), nowMs: () => Date.parse("2026-10-21T12:00:00Z") }).getActual(FORECAST_RANGE);
    const result = calculateUpdatedResult({ comparison, acceptedAtUtc: NOW, report: { id: REPORT_ID, kind: "ran", reportedStartUtc: comparison.selected.startUtc, profileStillApplicable: true, createdAtUtc: "2026-10-21T10:01:00Z" }, actualSnapshot: actual!.snapshot, actualSnapshotHash: actual!.hash }, "2026-10-21T12:01:00Z");
    expect(result.status).toBe("actual_pending"); expect(result.baselineActualMg).toBeNull(); expect(result.reportedActualMg).toBeNull(); expect(result.differenceMg).toBeNull();
  });
});
