import { normalizeGridSnapshot } from "@/domain/grid";
import { normalizeSchedule } from "@/domain/activities/constraints";
import { solveSchedule } from "@/domain/activities/scheduler";
import { scheduleInputSchema } from "@/domain/activities/schemas";
import { scheduleComparisonSchema } from "@/contracts/schedules";
import { resolveActivity } from "@/domain/activities/energy";
import { utcFromSeconds } from "@/domain/time";
const now = "2026-10-23T06:00:00Z", first = Date.parse("2026-10-23T07:00:00Z") / 1000;
/** Authored demo only. It never enters live comparison APIs or saved records. */
export function householdDemo(scenario: "normal" | "too_short" | "conflict" | "no_improvement" | "missing" = "normal") {
  const task = (id: string, category: "washing" | "drying" | "television", energyMwh: number, duration: number, baseline: number) => ({ activity: { schemaVersion: 2, id, category, name: { washing: "Laundry", drying: "Drying", television: "Evening TV" }[category], durationMinutes: duration, quantity: 1, energy: { kind: "cycle_energy", energyMwh, origin: "user_estimate", confirmed: true } }, baselineStartUtc: utcFromSeconds(first + baseline * 60), windows: [{ startUtc: utcFromSeconds(first), endUtc: utcFromSeconds(first + 21600) }], blocks: [], fixedStartUtc: category === "television" ? utcFromSeconds(first + baseline * 60) : null, resourceIds: [], requiresAttention: false, predecessorIds: category === "drying" ? ["wash"] : [] });
  const tasks = [task("wash", "washing", 500000, 60, 0), task("dry", "drying", 1000000, 60, 60), task("tv", "television", 100000, 60, 180)];
  if (scenario === "too_short") tasks[0]!.windows[0]!.endUtc = utcFromSeconds(first + 900);
  if (scenario === "conflict") tasks[1]!.baselineStartUtc = utcFromSeconds(first + 1800);
  const input = scheduleInputSchema.parse({ schemaVersion: 2, kind: "day", dayDate: "2026-10-23", geography: "GB_NATIONAL", timezone: "Europe/London", tasks });
  const snapshot = normalizeGridSnapshot({ geography: "GB_NATIONAL", sourceUrl: "https://example.invalid/carbonshift/authored-household-v2", retrievedAtUtc: now, providerIssuedAtUtc: null, license: "Authored synthetic demo, not a provider response", intervals: Array.from({ length: 12 }, (_, i) => ({ fromUtc: utcFromSeconds(first + i * 1800), toUtc: utcFromSeconds(first + (i + 1) * 1800), forecastGPerKwh: scenario === "missing" && i === 5 ? null : scenario === "no_improvement" ? 200 : [320, 300, 280, 250, 80, 60, 90, 120, 180, 230, 260, 290][i], actualGPerKwh: null })) });
  const normalized = normalizeSchedule(input, [], now), solution = solveSchedule(normalized, snapshot, now);
  return scheduleComparisonSchema.parse({ schemaVersion: 2, version: 1, id: "00000000-0000-4000-8000-000000000001", methodVersion: "carbonshift-gb-activities-v2", input: normalized.input, activities: input.tasks.map((t) => resolveActivity(t.activity)), grid: { id: "00000000-0000-4000-8000-000000000001", hash: `0x${"a".repeat(64)}`, snapshot, attribution: "Authored synthetic example — no API, save or chain transaction" }, solution, createdAtUtc: now, expiresAtUtc: "2026-10-23T06:05:00Z" });
}
