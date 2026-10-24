import { activityInputSchema, type ActivityInputV2, type ReferenceProfileV2 } from "@/domain/activities/schemas";
import { decimalToInteger } from "@/domain/activities/energy";
import type { ActivitySuggestion } from "@/contracts/activity-ai";

export const ACTIVITY_LABELS: Record<ActivityInputV2["category"], string> = { washing: "Clothes washing", dishwasher: "Dishwasher", drying: "Tumble drying", television: "Television", computer: "Computer", lighting: "Lighting", fan: "Fan", vacuuming: "Vacuuming", ironing: "Ironing", car_cleaning: "Car cleaning", charging: "Charging", custom: "Custom activity" };
export type ActivityDraft = { id: string; category: ActivityInputV2["category"]; name: string; duration: string; quantity: string; energyKind: "average_power" | "cycle_energy" | "reference" | "no_direct_electricity"; energyValue: string; origin: "user_estimate" | "user_reported_measurement" | "device_label"; profileId: string; confirmed: boolean };
export function emptyActivity(id = "activity-1"): ActivityDraft { return { id, category: "custom", name: "", duration: "", quantity: "1", energyKind: "average_power", energyValue: "", origin: "user_estimate", profileId: "", confirmed: false }; }
export function compileActivity(draft: ActivityDraft, profiles: readonly ReferenceProfileV2[]): ActivityInputV2 {
  if (!draft.confirmed) throw new Error("Confirm the energy basis and operating assumptions before calculating.");
  const profile = profiles.find((p) => p.id === draft.profileId);
  let energy: ActivityInputV2["energy"];
  if (draft.energyKind === "reference") {
    if (!profile) throw new Error("Choose a reviewed appliance reference, or enter your own power or energy.");
    energy = { kind: "reference", profileId: profile.id, profileVersion: profile.version, confirmed: true };
  } else if (draft.energyKind === "no_direct_electricity") energy = { kind: "no_direct_electricity", confirmed: true };
  else {
    if (!draft.energyValue.trim()) throw new Error("Enter your device's operating watts or energy per cycle.");
    const value = decimalToInteger(draft.energyValue, draft.energyKind === "average_power" ? 3 : 6);
    energy = draft.energyKind === "average_power" ? { kind: "average_power", powerMw: value, origin: draft.origin, confirmed: true } : { kind: "cycle_energy", energyMwh: value, origin: draft.origin, confirmed: true };
  }
  const result = activityInputSchema.safeParse({ schemaVersion: 2, id: draft.id, category: draft.category, name: draft.name.trim() || ACTIVITY_LABELS[draft.category], durationMinutes: Number(draft.duration), quantity: Number(draft.quantity), energy });
  if (!result.success) throw new Error("Use a duration of 1–2,880 whole minutes, 1–50 devices/cycles and a positive supported power or energy value.");
  return result.data;
}
export function draftFromSuggestion(suggestion: ActivitySuggestion["tasks"][number], id: string): ActivityDraft {
  const draft = { ...emptyActivity(id), category: suggestion.category, name: ACTIVITY_LABELS[suggestion.category], duration: suggestion.durationMinutes?.toString() ?? "", quantity: suggestion.quantity?.toString() ?? "1" };
  const match = suggestion.energyText?.match(/^(\d+(?:\.\d+)?)\s*(kWh|Wh|kW|W)$/i);
  if (match) {
    const unit = match[2]!.toLowerCase(), value = Number(match[1]);
    draft.energyKind = unit.endsWith("wh") ? "cycle_energy" : "average_power";
    draft.energyValue = String(unit === "kw" ? value * 1000 : unit === "wh" ? value / 1000 : value);
  }
  return draft;
}
export const activityKwh = (mwh: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 6 }).format(mwh / 1_000_000);
