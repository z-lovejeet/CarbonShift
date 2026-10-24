import "server-only";
import { ACTIVITY_METHOD, resolveActivity, estimateActivity } from "@/domain/activities";
import { assertForecastFreshness } from "@/domain/grid";
import { epochSeconds, addSeconds, halfHourCoverage } from "@/domain/time";
import { simulationRequestSchema, simulationDocumentSchema, type SimulationDocument } from "@/contracts/activities";
import { ACTIVITY_PROFILES } from "@/data/activity-profiles";
import { parseDomain } from "@/domain/errors";
import { ApiError } from "@/server/http/errors";
import type { GridSnapshotRecord } from "@/server/grid/snapshot";
import type { GridRange } from "@/server/grid/provider";

export type SimulationSources = { getForecast(range: GridRange): Promise<GridSnapshotRecord>; getActual(range: GridRange): Promise<GridSnapshotRecord | null> };
export async function simulateActivity(input: unknown, sources: SimulationSources, clock: () => string): Promise<SimulationDocument> {
  const nowUtc = clock();
  const request = parseDomain(simulationRequestSchema, input), activity = resolveActivity(request.activity, ACTIVITY_PROFILES);
  const endUtc = addSeconds(request.startUtc, activity.durationSeconds), now = epochSeconds(nowUtc), start = epochSeconds(request.startUtc), end = epochSeconds(endUtc);
  if (end > now + ACTIVITY_METHOD.forecastHorizonSeconds) throw new ApiError("OUTSIDE_PLANNING_HORIZON", 422, "Choose a task ending within the next 48 hours.");
  if (start < now - 96 * 3600) throw new ApiError("OUTSIDE_PLANNING_HORIZON", 422, "Retrospective simulation currently covers the last four days.");
  if (start < Math.floor(now / 1800) * 1800 && end > now) throw new ApiError("INVALID_TIME_WINDOW", 422, "Choose a finished activity for a retrospective estimate, or a start in the current half-hour or later for a forecast.");
  const factorKind = end <= now ? "actual" : "forecast";
  let grid: GridSnapshotRecord | null = null, message: string | null = null;
  if (activity.energyMwh > 0) {
    try {
      const range = halfHourCoverage(request.startUtc, endUtc);
      grid = factorKind === "forecast" ? await sources.getForecast(range) : await sources.getActual(range);
      if (grid && factorKind === "forecast") assertForecastFreshness(grid.snapshot, clock());
    } catch {
      grid = null; message = "Electricity is calculated from your inputs. Grid data is unavailable for this period, so the CO₂ estimate is unavailable. Try refreshing shortly.";
    }
  }
  const estimate = estimateActivity(activity, request.startUtc, grid?.snapshot ?? null, factorKind);
  if (estimate.status === "incomplete_grid" && message === null) message = "Some grid factors are missing for this activity. Electricity is available; a complete CO₂ estimate is not yet available.";
  return simulationDocumentSchema.parse({ schemaVersion: 2, methodVersion: ACTIVITY_METHOD.version, activity, estimate, grid, calculatedAtUtc: clock(),
    dataStatus: activity.energyMwh === 0 ? "not_required" : grid === null ? "unavailable" : estimate.estimatedMg === null ? "partial" : "available", message });
}
