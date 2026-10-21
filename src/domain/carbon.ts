import { z } from "zod";
import { DomainError, parseDomain } from "./errors";
import { METHOD } from "./method";
import { parseEnergyBins } from "./profile";
import { gridSnapshotSchema } from "./schemas";
import { safeNonnegativeInteger } from "./schemas/primitives";
import { epochSeconds } from "./time";

function safeTotal(total: bigint): number {
  if (total < 0n || total > BigInt(Number.MAX_SAFE_INTEGER)) throw new DomainError("NUMERIC_OVERFLOW", "Carbon total exceeds safe integer mg.");
  return Number(total);
}

export function alignedCarbonMg(energyWhBins: readonly number[], factorGPerKwh: readonly number[]): number {
  const bins = parseEnergyBins(energyWhBins), factors = parseDomain(z.array(safeNonnegativeInteger).min(1).max(METHOD.maximumProfileBins), factorGPerKwh);
  if (bins.length !== factors.length) throw new DomainError("INVALID_INPUT", "Each energy bin requires one factor.");
  return safeTotal(bins.reduce((total, bin, i) => total + BigInt(bin) * BigInt(factors[i]!), 0n));
}

/** Null means incomplete required actual factors. Never return a partial numeric total. */
export function actualCarbonMg(startUtc: string, energyWhBins: readonly number[], snapshotInput: unknown): number | null {
  const start = epochSeconds(startUtc), bins = parseEnergyBins(energyWhBins);
  const snapshot = parseDomain(gridSnapshotSchema, snapshotInput, "INVALID_GRID_SNAPSHOT");
  let numerator = 0n;
  for (let i = 0; i < bins.length; i++) {
    const binStart = start + i * METHOD.intervalSeconds, binEnd = binStart + METHOD.intervalSeconds;
    let coveredSeconds = 0;
    for (const interval of snapshot.intervals) {
      const overlap = Math.max(0, Math.min(binEnd, epochSeconds(interval.toUtc)) - Math.max(binStart, epochSeconds(interval.fromUtc)));
      if (overlap === 0) continue;
      if (interval.actualGPerKwh === null) return null;
      coveredSeconds += overlap;
      numerator += BigInt(bins[i]!) * BigInt(interval.actualGPerKwh) * BigInt(overlap);
    }
    if (coveredSeconds !== METHOD.intervalSeconds) return null;
  }
  // Nonnegative round-half-up, once for the entire cycle (not each fragment/bin).
  return safeTotal((numerator + BigInt(METHOD.intervalSeconds / 2)) / BigInt(METHOD.intervalSeconds));
}

export function carbonDifference(baselineMg: number, comparedMg: number): { differenceMg: number; differencePercent: number | null } {
  parseDomain(safeNonnegativeInteger, baselineMg);
  parseDomain(safeNonnegativeInteger, comparedMg);
  const differenceMg = baselineMg - comparedMg;
  return { differenceMg, differencePercent: baselineMg > 0 ? 100 * differenceMg / baselineMg : null };
}
