import type { ScheduleDocument } from "@/domain/activities/schedule-documents";
import { selectedSchedule } from "@/domain/activities/schedule-documents";
import { scheduleReportSchema, type ScheduleReport, type TaskResult, type ScheduleHistory } from "@/domain/activities/report-schemas";
import { parseDomain, DomainError } from "../errors";
import { addSeconds, epochSeconds, overlaps } from "../time";
import { estimateActivity } from "./carbon";
export type ResultAmounts = Pick<TaskResult, "state" | "baselineActualMg" | "reportedActualMg" | "differenceMg" | "deviationCodes">;
export function taskResultAmounts(plan: ScheduleDocument, reportValue: ScheduleReport, snapshot: unknown | null, nowUtc: string): ResultAmounts {
  const report = parseDomain(scheduleReportSchema, reportValue, "INVALID_REPORT"), input = plan.comparison.input.tasks.find((t) => t.activity.id === report.taskId), activity = plan.comparison.activities.find((a) => a.input.id === report.taskId), selected = selectedSchedule(plan).tasks.find((t) => t.taskId === report.taskId);
  if (!input || !activity || !selected || report.scheduleId !== plan.id) throw new DomainError("INVALID_REPORT", "This task does not belong to this schedule.");
  if (report.reportedAtUtc < plan.acceptedAtUtc || report.reportedAtUtc > nowUtc) throw new DomainError("INVALID_REPORT", "Report time must follow acceptance and not be in the future.");
  const result: ResultAmounts = { state: "pending", baselineActualMg: null, reportedActualMg: null, differenceMg: null, deviationCodes: [] };
  if (report.kind === "did_not_run") { if (report.actualStartUtc !== null || report.profileUnchanged !== null) throw new DomainError("INVALID_REPORT", "A non-run has no start or energy confirmation."); return { ...result, state: "did_not_run" }; }
  if (report.actualStartUtc === null || report.profileUnchanged === null) throw new DomainError("INVALID_REPORT", "Report the actual start and whether the accepted energy basis still applies.");
  const end = addSeconds(report.actualStartUtc, activity.durationSeconds);
  if (report.actualStartUtc < plan.acceptedAtUtc || end > report.reportedAtUtc) throw new DomainError("INVALID_REPORT", "The reported activity must start after acceptance and finish before reporting.");
  if (epochSeconds(report.actualStartUtc) > epochSeconds(input.windows.at(-1)!.endUtc) + 96 * 3600) throw new DomainError("INVALID_REPORT", "This report is outside the supported four-day reporting extension. Use a separate simulation for this activity.");
  if (report.actualStartUtc !== selected.startUtc) result.deviationCodes.push("DIFFERENT_START");
  if (!input.windows.some((w) => report.actualStartUtc! >= w.startUtc && end <= w.endUtc)) result.deviationCodes.push("OUTSIDE_WINDOWS");
  if (input.blocks.some((b) => overlaps(report.actualStartUtc!, end, b.startUtc, b.endUtc))) result.deviationCodes.push("BLOCKED_PERIOD");
  if (!report.profileUnchanged) return { ...result, state: "profile_changed" };
  const baseline = estimateActivity(activity, input.baselineStartUtc, snapshot, "actual"), actual = estimateActivity(activity, report.actualStartUtc, snapshot, "actual");
  if (baseline.endUtc > nowUtc || baseline.estimatedMg === null || actual.estimatedMg === null) return result;
  return { ...result, state: "complete", baselineActualMg: baseline.estimatedMg, reportedActualMg: actual.estimatedMg, differenceMg: baseline.estimatedMg - actual.estimatedMg };
}
export function aggregateSchedule(plan: ScheduleDocument, history: ScheduleHistory) {
  const counts = { total: plan.comparison.input.tasks.length, covered: 0, missingFactors: 0, notReported: 0, didNotRun: 0, profileChanged: 0 };
  let baselineMg = 0, reportedMg = 0;
  for (const task of plan.comparison.input.tasks) {
    const report = history.reports.filter((r) => r.taskId === task.activity.id).at(-1), result = report ? history.results.filter((r) => r.taskId === task.activity.id && r.reportId === report.id).at(-1) : null;
    if (!report) counts.notReported++; else if (!result || result.state === "pending") counts.missingFactors++; else if (result.state === "did_not_run") counts.didNotRun++; else if (result.state === "profile_changed") counts.profileChanged++; else { counts.covered++; baselineMg += result.baselineActualMg!; reportedMg += result.reportedActualMg!; }
  }
  const allCovered = counts.covered === counts.total;
  return { counts, wholeSchedule: allCovered ? { baselineMg, reportedMg, differenceMg: baselineMg - reportedMg } : null, coveredSubtotal: counts.covered ? { baselineMg, reportedMg, differenceMg: baselineMg - reportedMg } : null };
}
