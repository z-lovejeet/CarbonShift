import { createHash, randomUUID } from "node:crypto";
import { reportDocumentSchema, resultRevisionSchema, type ReportDocument, type ReportRequest } from "@/contracts/lifecycle";
import type { Plan } from "@/contracts/planning";
import { calculateUpdatedResult } from "@/domain/results";
import { updatedResultSchema, executionReportSchema } from "@/domain/schemas";
import { addSeconds, overlaps } from "@/domain/time";
import type { GridSnapshotRecord } from "@/server/grid/snapshot";
import { ApiError } from "@/server/http/errors";
import type { LifecycleAction, LifecycleRepository } from "./lifecycle-repository";

type Dependencies = { repository: LifecycleRepository; now: () => string; actual: (range: { fromUtc: string; toUtc: string }) => Promise<GridSnapshotRecord | null> };
function coreReport(report: ReportDocument) { return executionReportSchema.parse({ id: report.id, createdAtUtc: report.createdAtUtc, kind: report.kind, reportedStartUtc: report.reportedStartUtc, profileStillApplicable: report.profileStillApplicable }); }
export function resultIdentity(plan: Plan, report: ReportDocument, revision: ReturnType<typeof resultRevisionSchema.parse>, snapshot: GridSnapshotRecord | null) {
  const { snapshotHash: _hash, ...result } = revision.result; void _hash;
  const intervals = report.reportedStartUtc === null ? [] : snapshot?.snapshot.intervals.filter((interval) =>
    overlaps(interval.fromUtc, interval.toUtc, plan.comparison.baseline.startUtc, plan.comparison.baseline.endUtc) || overlaps(interval.fromUtc, interval.toUtc, report.reportedStartUtc!, addSeconds(report.reportedStartUtc!, plan.comparison.constraints.durationMinutes * 60)))
    .map(({ fromUtc, toUtc, actualGPerKwh }) => ({ fromUtc, toUtc, actualGPerKwh })) ?? [];
  return createHash("sha256").update(JSON.stringify({ result, intervals })).digest("hex");
}
export function createLifecycleService({ repository, now, actual }: Dependencies) {
  async function makeRevision(plan: Plan, report: ReportDocument, reason: "submitted" | "correction" | "refresh" | "cancelled") {
    const stamp = now();
    let snapshot: GridSnapshotRecord | null = null;
    let result;
    if (reason === "cancelled") {
      result = updatedResultSchema.parse({ status: "did_not_run", executionBasis: "self_reported", energyBasis: plan.comparison.constraints.energyBasis, methodVersion: plan.comparison.methodVersion,
        reportId: report.id, snapshotHash: null, baselineActualMg: null, reportedActualMg: null, differenceMg: null, differencePercent: null, reasonCodes: [], deviationCodes: [] });
    } else {
      // Validate timing/profile before any network work, including corrections.
      const input = { comparison: plan.comparison, acceptedAtUtc: plan.acceptedAtUtc, report: coreReport(report), actualSnapshot: null, actualSnapshotHash: null };
      result = calculateUpdatedResult(input, stamp);
      if (result.status === "actual_pending" && report.reportedStartUtc !== null) {
        const end = addSeconds(report.reportedStartUtc, plan.comparison.constraints.durationMinutes * 60);
        try { snapshot = await actual({ fromUtc: [plan.comparison.baseline.startUtc, report.reportedStartUtc].sort()[0]!, toUtc: [plan.comparison.baseline.endUtc, end].sort().at(-1)! }); }
        catch { /* Reports remain durable when the external actual feed is unavailable. */ }
        result = calculateUpdatedResult({ ...input, actualSnapshot: snapshot?.snapshot ?? null, actualSnapshotHash: snapshot?.hash ?? null }, now());
      }
    }
    const revision = resultRevisionSchema.parse({ schemaVersion: 1, id: randomUUID(), planId: plan.id, sequence: (plan.latestResult?.sequence ?? 0) + 1,
      reportId: report.id, createdAtUtc: now(), reason, actualSnapshotId: snapshot?.id ?? null, result });
    return { revision, snapshot, semantic: resultIdentity(plan, report, revision, snapshot) };
  }
  async function start(planId: string, action: LifecycleAction, key: string, digest: string) {
    const replay = await repository.replay(planId, action, key, digest);
    if (replay) return { replay } as const;
    const plan = await repository.detail(planId);
    if (action !== "delete" && plan.status === "cancelled") throw new ApiError("PLAN_CANCELLED", 409, "This plan is cancelled. Create a new plan to run again.");
    return { plan } as const;
  }
  return {
    async report(planId: string, input: ReportRequest, key: string, digest: string) {
      const context = await start(planId, "report", key, digest); if (context.replay) return context.replay;
      const plan = context.plan!;
      if (input.correctsReportId !== (plan.latestReport?.id ?? null)) throw new ApiError("VERSION_CONFLICT", 409, "A newer report exists. Reload before correcting it.");
      const report = reportDocumentSchema.parse({ ...input, schemaVersion: 1, id: randomUUID(), planId, sequence: (plan.latestReport?.sequence ?? 0) + 1, createdAtUtc: now(), source: "report" });
      const result = await makeRevision(plan, report, input.correctsReportId ? "correction" : "submitted");
      return repository.commit({ planId, action: "report", key, digest, expectedVersion: plan.version, report, ...result });
    },
    async cancel(planId: string, key: string, digest: string, note = "") {
      const context = await start(planId, "cancel", key, digest); if (context.replay) return context.replay;
      const plan = context.plan!;
      if (plan.latestReport || now() >= plan.comparison.selected.startUtc) throw new ApiError("INVALID_REPORT", 422, "Cancel before the selected start, while execution is unreported.");
      const report = reportDocumentSchema.parse({ schemaVersion: 1, id: randomUUID(), planId, sequence: 1, createdAtUtc: now(), kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, correctsReportId: null, reason: "cancelled_before_start", note, source: "cancellation" });
      return repository.commit({ planId, action: "cancel", key, digest, expectedVersion: plan.version, report, ...await makeRevision(plan, report, "cancelled") });
    },
    async refresh(planId: string, expected: number, key: string, digest: string) {
      const context = await start(planId, "refresh", key, digest); if (context.replay) return context.replay;
      const plan = context.plan!;
      if (!plan.latestReport || !plan.latestResult) throw new ApiError("INVALID_REPORT", 422, "Report execution before refreshing its estimate.");
      if (plan.latestResult.sequence !== expected) throw new ApiError("VERSION_CONFLICT", 409, "A newer result exists. Reload before refreshing.");
      return repository.commit({ planId, action: "refresh", key, digest, expectedVersion: plan.version, report: null, ...await makeRevision(plan, plan.latestReport, "refresh") });
    },
    async delete(planId: string, key: string, digest: string) {
      const context = await start(planId, "delete", key, digest); if (context.replay) return context.replay;
      return repository.commit({ planId, action: "delete", key, digest, expectedVersion: context.plan!.version, report: null, revision: null, semantic: null, snapshot: null });
    },
  };
}
