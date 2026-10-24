import { DomainError, parseDomain } from "../errors";
import { freezeDomain } from "../method";
import { ACTIVITY_METHOD as M } from "./method";
import { activityInputSchema, referenceProfileSchema, resolvedActivitySchema, type ReferenceProfileV2, type ResolvedActivityV2 } from "./schemas";

export function roundRatio(numerator: bigint, denominator: bigint): number {
  if (numerator < 0n || denominator <= 0n) throw new DomainError("INVALID_INPUT", "Use nonnegative energy and positive duration.");
  const rounded = (numerator * 2n + denominator) / (denominator * 2n);
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new DomainError("NUMERIC_OVERFLOW", "The result exceeds the supported calculation range.");
  return Number(rounded);
}

/** Decimal input is converted without floating-point multiplication. */
export function decimalToInteger(value: string, places: number): number {
  if (!Number.isInteger(places) || places < 0 || places > 6 || !/^\d+(?:\.\d+)?$/.test(value) || value.length > 24)
    throw new DomainError("INVALID_INPUT", "Enter a positive decimal number without units.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > places) throw new DomainError("INVALID_INPUT", `Use at most ${places} decimal places.`);
  return roundRatio(BigInt(whole!) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, "0") || "0"), 1n);
}

export function resolveActivity(input: unknown, references: readonly ReferenceProfileV2[] = []): ResolvedActivityV2 {
  const activity = parseDomain(activityInputSchema, input);
  const durationSeconds = activity.durationMinutes * 60;
  const energy = activity.energy;
  let reference: ReferenceProfileV2 | null = null;
  let perDevice: number;
  const limitations: ResolvedActivityV2["limitations"] = ["electricity_only"];
  if (energy.kind === "reference") {
    const match = references.find((p) => p.id === energy.profileId && p.version === energy.profileVersion);
    if (!match) throw new DomainError("INVALID_INPUT", "This energy reference is unavailable. Choose a reviewed reference or enter your device energy.", [{ path: "energy", message: "Unknown reference or version." }]);
    reference = parseDomain(referenceProfileSchema, match);
    if (reference.category !== activity.category) throw new DomainError("INVALID_INPUT", "Choose an energy reference for this activity category.");
    perDevice = reference.basis.kind === "cycle" ? reference.basis.energyMwh : roundRatio(BigInt(reference.basis.powerMw) * BigInt(durationSeconds) * BigInt(activity.quantity), 3600n);
    limitations.push("estimated_energy", reference.basis.kind === "cycle" ? "uniform_cycle" : "constant_power");
    if (reference.basis.kind === "power" && reference.basis.rating !== "average") limitations.push("nameplate_scenario");
  } else if (energy.kind === "average_power") {
    perDevice = roundRatio(BigInt(energy.powerMw) * BigInt(durationSeconds) * BigInt(activity.quantity), 3600n);
    limitations.push(energy.origin === "user_reported_measurement" ? "user_reported_energy" : "estimated_energy", "constant_power");
    if (energy.origin === "device_label") limitations.push("nameplate_scenario");
  } else if (energy.kind === "cycle_energy") {
    perDevice = energy.energyMwh;
    limitations.push(energy.origin === "user_reported_measurement" ? "user_reported_energy" : "estimated_energy", "uniform_cycle");
  } else {
    perDevice = 0; limitations.push("no_direct_electricity");
  }
  const isCycle = energy.kind === "cycle_energy" || reference?.basis.kind === "cycle";
  const energyMwh = isCycle ? perDevice * activity.quantity : perDevice;
  if (!Number.isSafeInteger(energyMwh) || energyMwh > M.maximumEnergyMwh) throw new DomainError("INVALID_INPUT", "Reduce the duration, energy or device count: this task exceeds 1,000 kWh.");
  return freezeDomain(parseDomain(resolvedActivitySchema, { input: activity, durationSeconds, energyMwh,
    segments: [{ offsetSeconds: 0, durationSeconds, energyMwh }], reference, limitations }));
}
