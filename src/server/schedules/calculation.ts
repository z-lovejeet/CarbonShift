import "server-only";
import { randomUUID } from "node:crypto";
import { normalizeSchedule } from "@/domain/activities/constraints";
import { solveSchedule } from "@/domain/activities/scheduler";
import { ACTIVITY_METHOD as M } from "@/domain/activities/method";
import { ACTIVITY_PROFILES } from "@/data/activity-profiles";
import { addSeconds, epochSeconds, halfHourCoverage, utcFromSeconds } from "@/domain/time";
import { scheduleComparisonSchema, compareScheduleRequestSchema, type ScheduleComparison } from "@/contracts/schedules";
import { parseDomain, DomainError } from "@/domain/errors";
import type { SimulationSources } from "@/server/activities/service";
export async function calculateSchedule(value: unknown, sources: SimulationSources, clock: () => string): Promise<ScheduleComparison> {
  const request = parseDomain(compareScheduleRequestSchema, value), normalized = normalizeSchedule(request.input, ACTIVITY_PROFILES, clock());
  const grid = await sources.getForecast(halfHourCoverage(normalized.fromUtc, normalized.toUtc));
  const createdAtUtc = clock(), solution = solveSchedule(normalized, grid.snapshot, createdAtUtc);
  const earliest = [solution.baseline, solution.selected, ...solution.alternatives].flatMap((o) => o.tasks.map((t) => epochSeconds(t.startUtc)));
  const expiresAtUtc = utcFromSeconds(Math.min(epochSeconds(addSeconds(createdAtUtc, M.comparisonLifetimeSeconds)), ...earliest.map((s) => s - M.operationalBufferSeconds)));
  if (expiresAtUtc <= createdAtUtc) throw new DomainError("COMPARISON_EXPIRED", "Choose a later start to leave time to review and save.");
  return scheduleComparisonSchema.parse({ schemaVersion: 2, version: 1, id: randomUUID(), methodVersion: M.version, input: normalized.input, activities: normalized.tasks.map((t) => t.activity), grid, solution, createdAtUtc, expiresAtUtc });
}
