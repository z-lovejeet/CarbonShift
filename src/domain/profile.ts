import { z } from "zod";
import { parseDomain } from "./errors";
import { METHOD } from "./method";
import { durationSchema, energyWhSchema } from "./schemas";

export function uniformEnergyBins(energyWh: number, durationMinutes: number): readonly number[] {
  parseDomain(energyWhSchema, energyWh);
  parseDomain(durationSchema, durationMinutes);
  const count = durationMinutes / METHOD.intervalMinutes, q = Math.floor(energyWh / count), r = energyWh % count;
  return Object.freeze(Array.from({ length: count }, (_, i) => q + (i < r ? 1 : 0)));
}

/** Preserve the form's decimal text; floating-point multiplication is not a units parser. */
export function energyWhFromKwh(input: string): number {
  const value = parseDomain(z.string().max(16).regex(/^(0|[1-9]\d*)(\.\d{1,3})?$/).refine((text) => text.trim() === text), input);
  const [whole = "", fraction = ""] = value.split(".");
  return parseDomain(energyWhSchema, Number(whole) * 1000 + Number(fraction.padEnd(3, "0")));
}

const binsSchema = z.array(z.number().int().min(0).max(METHOD.maximumEnergyWh)).min(1).max(METHOD.maximumProfileBins).refine((bins) => {
  const energy = bins.reduce((sum, bin) => sum + bin, 0), q = Math.floor(energy / bins.length), r = energy % bins.length;
  return energy >= METHOD.minimumEnergyWh && energy <= METHOD.maximumEnergyWh && bins.every((bin, i) => bin === q + (i < r ? 1 : 0));
}, "Expected a supported uniform energy profile in integer Wh.");

export function parseEnergyBins(bins: readonly number[]): readonly number[] {
  return Object.freeze(parseDomain(binsSchema, bins));
}
