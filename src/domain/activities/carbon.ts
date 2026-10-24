import { parseDomain } from "../errors";
import { normalizeGridSnapshot } from "../grid";
import { freezeDomain } from "../method";
import { epochSeconds, utcFromSeconds } from "../time";
import { utcInstantSchema } from "../schemas/primitives";
import { resolvedActivitySchema } from "./schemas";
import { roundRatio } from "./energy";

function gcd(a: bigint, b: bigint): bigint { while (b !== 0n) { const r = a % b; a = b; b = r; } return a; }
function plus(a: readonly [bigint, bigint], n: bigint, d: bigint): readonly [bigint, bigint] {
  const shared = gcd(a[1], d), denominator = a[1] / shared * d;
  const numerator = a[0] * (d / shared) + n * (a[1] / shared), divisor = gcd(numerator, denominator);
  return [numerator / divisor, denominator / divisor];
}
export type ActivityEstimateV2 = {
  startUtc: string; endUtc: string; energyMwh: number; estimatedMg: number | null;
  status: "available" | "incomplete_grid" | "no_direct_electricity";
  factorKind: "forecast" | "actual";
  intervals: { fromUtc: string; toUtc: string; factorGPerKwh: number | null; roundedEnergyMwh: number; roundedMg: number | null }[];
};

/** A missing second or factor makes the whole-task carbon estimate unavailable. */
export function estimateActivity(activityInput: unknown, start: string, snapshotInput: unknown, factorKind: "forecast" | "actual" = "forecast"): ActivityEstimateV2 {
  const activity = parseDomain(resolvedActivitySchema, activityInput);
  const startUtc = parseDomain(utcInstantSchema, start), begin = epochSeconds(startUtc);
  const endUtc = utcFromSeconds(begin + activity.durationSeconds);
  if (activity.energyMwh === 0) return freezeDomain({ startUtc, endUtc, energyMwh: 0, estimatedMg: 0, status: "no_direct_electricity", factorKind, intervals: [] });
  if (snapshotInput === null) return freezeDomain({ startUtc, endUtc, energyMwh: activity.energyMwh, estimatedMg: null, status: "incomplete_grid", factorKind, intervals: [] });
  const snapshot = normalizeGridSnapshot(snapshotInput);
  let total: readonly [bigint, bigint] = [0n, 1n], complete = true;
  const intervals: ActivityEstimateV2["intervals"] = [];
  for (const segment of activity.segments) {
    const from = begin + segment.offsetSeconds, to = from + segment.durationSeconds;
    let covered = 0;
    for (const interval of snapshot.intervals) {
      const a = Math.max(from, epochSeconds(interval.fromUtc)), b = Math.min(to, epochSeconds(interval.toUtc));
      if (a >= b) continue;
      const seconds = b - a, factor = factorKind === "forecast" ? interval.forecastGPerKwh : interval.actualGPerKwh;
      covered += seconds;
      const energyNumerator = BigInt(segment.energyMwh) * BigInt(seconds), denominator = BigInt(segment.durationSeconds);
      if (factor === null) complete = false;
      else total = plus(total, energyNumerator * BigInt(factor), denominator * 1000n);
      intervals.push({ fromUtc: utcFromSeconds(a), toUtc: utcFromSeconds(b), factorGPerKwh: factor,
        roundedEnergyMwh: roundRatio(energyNumerator, denominator), roundedMg: factor === null ? null : roundRatio(energyNumerator * BigInt(factor), denominator * 1000n) });
    }
    if (covered !== segment.durationSeconds) complete = false;
  }
  return freezeDomain({ startUtc, endUtc, energyMwh: activity.energyMwh, estimatedMg: complete ? roundRatio(total[0], total[1]) : null,
    status: complete ? "available" : "incomplete_grid", factorKind, intervals });
}
