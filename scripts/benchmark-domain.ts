import { cpus, platform, arch } from "node:os";
import { performance } from "node:perf_hooks";
import { GB_UNIFORM_V1_FIXTURE as fixture } from "../src/fixtures/demo/gb-uniform-v1";
import { createComparison } from "../src/domain/scheduling";

// Authored replay only. This benchmark is never a live planning clock or climate outcome.
const start = Date.parse(fixture.nowUtc) + 1800000;
const iso = (milliseconds: number) => new Date(milliseconds).toISOString().replace(".000Z", "Z");
const snapshot = {
  ...fixture.snapshot,
  intervals: Array.from({ length: 95 }, (_, i) => ({
    fromUtc: iso(start + i * 1800000), toUtc: iso(start + (i + 1) * 1800000),
    forecastGPerKwh: (i * 43) % 400, actualGPerKwh: null,
  })),
};
const measured = [30, 180].map((durationMinutes) => {
  const input = {
    constraints: { ...fixture.constraints, earliestStartUtc: iso(start), baselineStartUtc: iso(start), deadlineUtc: iso(start + 95 * 1800000), durationMinutes, energyWh: 5000 },
    snapshot, forecastSnapshotId: fixture.snapshotReference.id, forecastSnapshotHash: fixture.snapshotReference.hash,
  };
  for (let i = 0; i < 20; i++) createComparison(input, fixture.nowUtc);
  const timings = Array.from({ length: 200 }, () => {
    const before = performance.now(); createComparison(input, fixture.nowUtc); return performance.now() - before;
  }).sort((a, b) => a - b);
  const ms = (value: number) => Number(value.toFixed(3));
  return { durationMinutes, feasibleCandidates: 96 - durationMinutes / 30, samples: timings.length, p50Ms: ms(timings[99]!), p95Ms: ms(timings[189]!), maxMs: ms(timings[199]!) };
});
console.log(JSON.stringify({ fixtureMode: "authored_demo", environment: { platform: platform(), architecture: arch(), cpu: cpus()[0]?.model, node: process.version }, warmupPerCase: 20, measured, scope: "Pure comparison including schema validation, no network/UI/database; local measurements are not service p95." }, null, 2));
