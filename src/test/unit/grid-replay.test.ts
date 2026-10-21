import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import capture from "@/fixtures/grid/neso-national-recorded-v1.json" with { type: "json" };
import { createComparison } from "@/domain/scheduling";
import type { GridSnapshotV1 } from "@/domain/schemas";
import { createGridClient } from "@/server/grid/client";
import { hashGridSnapshot } from "@/server/grid/snapshot";
import { providerResponse } from "../fixtures/grid-provider";

function toProviderProjection(snapshot: { intervals: GridSnapshotV1["intervals"] }) {
  return { data: snapshot.intervals.map((interval) => ({ from: interval.fromUtc, to: interval.toUtc, intensity: { forecast: interval.forecastGPerKwh, actual: interval.actualGPerKwh } })) };
}

describe("M03.05 recorded provider replay (T05/T06 integration boundary)", () => {
  it("pins the immutable capture and labels its historical/assumed basis", () => {
    const bytes = readFileSync(new URL("../../fixtures/grid/neso-national-recorded-v1.json", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("17104136e47e5225bfd4d6708b3aef39cc1f8eb0f87c67a7dc0c0386af6b48e7");
    expect(capture.fixtureVersion).toBe("neso-national-recorded-v1"); expect(capture.replayOnly).toBe(true);
    expect(capture.dataOrigin).toBe("recorded_public_provider_normalized_snapshot");
    expect(capture.label).toContain("Never use this file as a live fallback");
    expect(capture.comparison.constraints.energyBasis).toBe("illustrative_default");
    expect(capture.forecast.snapshot.providerIssuedAtUtc).toBeNull();
  });
  it("replays captured forecast through the adapter and exact scheduler without live access", async () => {
    const fetcher = vi.fn(async () => providerResponse(toProviderProjection(capture.forecast.snapshot)));
    const client = createGridClient({ fetcher, nowMs: () => Date.parse(capture.forecast.snapshot.retrievedAtUtc) });
    const replay = await client.getForecast(capture.forecastRequest);
    expect(replay.snapshot).toEqual(capture.forecast.snapshot); expect(replay.hash).toBe(capture.forecast.hash);
    expect(replay.hash).toBe("0xb6eec1864f662be4a2ff5fe737756011f26327f40d73b9abb23ce41416435652");
    const result = createComparison({ constraints: capture.comparison.constraints, snapshot: replay.snapshot, forecastSnapshotId: replay.id, forecastSnapshotHash: replay.hash }, capture.comparison.createdAtUtc);
    expect(result).toEqual({ ...capture.comparison, forecastSnapshotId: replay.id });
    expect(result.baseline.estimatedMg).toBe(116000); expect(result.selected.estimatedMg).toBe(89500); expect(result.differenceMg).toBe(26500);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("replays actual-range provenance and factors without replacing nulls", async () => {
    const source = capture.actual;
    const replay = await createGridClient({ fetcher: async () => providerResponse(toProviderProjection(source.snapshot)), nowMs: () => Date.parse(source.snapshot.retrievedAtUtc) }).getActual(capture.actualRequest);
    expect(replay!.snapshot).toEqual(source.snapshot); expect(replay!.hash).toBe(source.hash);
    expect(replay!.snapshot.intervals).toHaveLength(5);
    expect(hashGridSnapshot(replay!.snapshot)).toBe("0x583b4439d81def1e0a9e10294233083ea2b9b69e73da7b647e0d34ada279a421");
  });
  it("fails an otherwise valid replay if a required forecast factor is missing", async () => {
    const response = toProviderProjection(capture.forecast.snapshot);
    response.data.find((interval) => interval.from === capture.forecastRequest.fromUtc)!.intensity.forecast = null;
    await expect(createGridClient({ fetcher: async () => providerResponse(response), nowMs: () => Date.parse(capture.forecast.snapshot.retrievedAtUtc) }).getForecast(capture.forecastRequest)).rejects.toMatchObject({ code: "INCOMPLETE_GRID_COVERAGE" });
  });
});
