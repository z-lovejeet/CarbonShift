import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createGridClient } from "@/server/grid/client";
import { createGridSnapshotRecord, hashGridSnapshot } from "@/server/grid/snapshot";
import { FORECAST_RANGE, GRID_NOW, providerPayload, providerResponse } from "../fixtures/grid-provider";

describe("M03.03 immutable snapshots and bounded cache (T05)", () => {
  it("retains retrieval age, ID, digest and immutable contents on a cache hit", async () => {
    let time = Date.parse(GRID_NOW);
    const fetcher = vi.fn(async () => providerResponse());
    const client = createGridClient({ fetcher, nowMs: () => time });
    const first = await client.getForecast(FORECAST_RANGE); time += 299999;
    const second = await client.getForecast(FORECAST_RANGE);
    expect(second).toBe(first); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second.snapshot.retrievedAtUtc).toBe(GRID_NOW); expect(second.snapshot.providerIssuedAtUtc).toBeNull();
    expect(() => { first.snapshot.intervals[0]!.forecastGPerKwh = 1; }).toThrow();
    expect(Object.isFrozen(first.snapshot.intervals)).toBe(true);
    time += 1;
    const refreshed = await client.getForecast(FORECAST_RANGE);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(refreshed.id).not.toBe(first.id);
    expect(refreshed.snapshot.retrievedAtUtc).toBe("2026-10-21T06:05:00Z");
    expect(refreshed.hash).not.toBe(first.hash);
  });
  it("coalesces simultaneous identical requests without cloning the source record", async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; }));
    const client = createGridClient({ fetcher, nowMs: () => Date.parse(GRID_NOW) });
    const pending = Array.from({ length: 12 }, () => client.getForecast(FORECAST_RANGE));
    expect(fetcher).toHaveBeenCalledTimes(1); complete(providerResponse());
    const records = await Promise.all(pending);
    expect(records.every((record) => record === records[0])).toBe(true);
  });
  it("keeps forecast and actual requests separate, with outward-normalized actual keys", async () => {
    const fetcher = vi.fn(async () => providerResponse());
    const client = createGridClient({ fetcher, nowMs: () => Date.parse(GRID_NOW) });
    await client.getForecast(FORECAST_RANGE); await client.getActual(FORECAST_RANGE);
    await client.getActual({ fromUtc: "2026-10-21T07:01:00Z", toUtc: "2026-10-21T10:59:00Z" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("removes failed flights and does not cache empty actual data", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(providerResponse({ bad: true })).mockResolvedValueOnce(providerResponse()).mockResolvedValue(providerResponse({ data: [] }));
    const client = createGridClient({ fetcher, nowMs: () => Date.parse(GRID_NOW) });
    await expect(client.getForecast(FORECAST_RANGE)).rejects.toMatchObject({ code: "INVALID_GRID_RESPONSE" });
    expect((await client.getForecast(FORECAST_RANGE)).snapshot.intervals).toHaveLength(8);
    await client.getActual(FORECAST_RANGE);
    // A fresh response object is needed for each independent fetch/body stream.
    fetcher.mockImplementation(async () => providerResponse({ data: [] }));
    await client.getActual(FORECAST_RANGE); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("refuses a clock-future cached record and never labels it freshly retrieved", async () => {
    let time = Date.parse(GRID_NOW);
    const client = createGridClient({ fetcher: async () => providerResponse(), nowMs: () => time });
    await client.getForecast(FORECAST_RANGE); time -= 1000;
    await expect(client.getForecast(FORECAST_RANGE)).rejects.toMatchObject({ code: "FUTURE_GRID_SNAPSHOT" });
  });
  it("evicts the least recently used record beyond 32 retained entries", async () => {
    const fetcher = vi.fn(async () => providerResponse());
    const client = createGridClient({ fetcher, nowMs: () => Date.parse(GRID_NOW) });
    const ranges = Array.from({ length: 33 }, (_, i) => ({ fromUtc: new Date(Date.parse(FORECAST_RANGE.fromUtc) + i * 1800000).toISOString().replace(".000Z", "Z"), toUtc: new Date(Date.parse(FORECAST_RANGE.toUtc) + i * 1800000).toISOString().replace(".000Z", "Z") }));
    for (const range of ranges.slice(0, 32)) await client.getActual(range);
    await client.getActual(ranges[0]!); // Retain the oldest inserted entry by using it.
    await client.getActual(ranges[32]!); await client.getActual(ranges[0]!);
    expect(fetcher).toHaveBeenCalledTimes(33);
    await client.getActual(ranges[1]!); expect(fetcher).toHaveBeenCalledTimes(34);
  });
  it("uses a stable fixed-field storage digest and copies caller inputs", async () => {
    const record = await createGridClient({ fetcher: async () => providerResponse(), nowMs: () => Date.parse(GRID_NOW) }).getForecast(FORECAST_RANGE);
    const expected = `0x${createHash("sha256").update("CarbonShift:grid-snapshot:v1\n" + JSON.stringify(record.snapshot), "utf8").digest("hex")}`;
    expect(record.hash).toBe(expected);
    expect(hashGridSnapshot(Object.fromEntries(Object.entries(record.snapshot).reverse()))).toBe(record.hash);
    const changed = structuredClone(record.snapshot); changed.intervals[0]!.forecastGPerKwh = 1;
    expect(hashGridSnapshot(changed)).not.toBe(record.hash);
    const cloned = createGridSnapshotRecord(changed); changed.intervals[0]!.forecastGPerKwh = 2;
    expect(cloned.snapshot.intervals[0]!.forecastGPerKwh).toBe(1);
    expect(hashGridSnapshot({ ...record.snapshot, retrievedAtUtc: "2026-10-21T06:01:00Z" })).not.toBe(record.hash);
  });
  it("keeps incomplete forecasts out of the cache", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(providerResponse(providerPayload([null, null]))).mockResolvedValueOnce(providerResponse());
    const client = createGridClient({ fetcher, nowMs: () => Date.parse(GRID_NOW) });
    await expect(client.getForecast(FORECAST_RANGE)).rejects.toMatchObject({ code: "INCOMPLETE_GRID_COVERAGE" });
    await client.getForecast(FORECAST_RANGE); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
