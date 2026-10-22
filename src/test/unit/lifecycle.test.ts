import { beforeEach, expect, it, vi } from "vitest";
import { createLifecycleService, resultIdentity } from "@/server/plans/lifecycle";
import { planSchema } from "@/contracts/planning";
import { createComparison } from "@/domain/scheduling";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { NOW, constraints, snapshot } from "../fixtures/domain";
import type { LifecycleWrite } from "@/server/plans/lifecycle-repository";
const id = "8d46189a-7ef2-46f2-a674-aea5b026d06e", record = createGridSnapshotRecord(snapshot());
const comparison = createComparison({ constraints: constraints(), snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, NOW);
const plan = planSchema.parse({ schemaVersion: 1, id, comparisonId: id, version: 1, mode: "live", status: "accepted", acceptedAtUtc: NOW, comparison, forecastSnapshot: record.snapshot, completion: "not_reported", publication: "private", latestReport: null, latestResult: null, reports: [], revisions: [] });
const detail = vi.fn(), replay = vi.fn(), commit = vi.fn(), actual = vi.fn();
const repository = { detail, replay, commit };
const now = () => "2026-10-21T12:00:00Z";
const service = () => createLifecycleService({ repository, now, actual });
const input = { kind: "ran" as const, reportedStartUtc: "2026-10-21T09:00:00Z", profileStillApplicable: true, correctsReportId: null, reason: "" };
beforeEach(() => { detail.mockReset().mockResolvedValue(plan); replay.mockReset().mockResolvedValue(null); commit.mockReset().mockImplementation(async (value: LifecycleWrite) => ({ planId: id, planVersion: value.expectedVersion + 1, reportId: value.report?.id ?? plan.latestReport?.id ?? null, resultId: value.revision?.id ?? null, changed: true, deleted: false })); actual.mockReset().mockResolvedValue(null); });
it("T08/T09 keeps a changed-profile report without unsupported amounts or a provider call", async () => {
  const frozen = JSON.stringify(plan.comparison);
  await service().report(id, { ...input, profileStillApplicable: false }, "report-key", "a".repeat(64));
  const value = commit.mock.calls[0]![0] as LifecycleWrite;
  expect(value.revision?.result).toMatchObject({ status: "outside_supported_window", reasonCodes: ["PROFILE_CHANGED"], differenceMg: null });
  expect(actual).not.toHaveBeenCalled(); expect(JSON.stringify(plan.comparison)).toBe(frozen);
});
it("T08/T09 records pending missing actual data rather than zero", async () => {
  actual.mockRejectedValue(new Error("private-provider-canary")); await service().report(id, input, "report-key", "a".repeat(64));
  expect(commit.mock.calls[0]![0].revision.result).toMatchObject({ status: "actual_pending", baselineActualMg: null, reportedActualMg: null, differenceMg: null });
});
it("T08 preserves a higher updated estimate with a signed negative difference", async () => {
  const data = snapshot([100, 100, 200, 200, 500, 500, 300, 300]); data.retrievedAtUtc = now(); actual.mockResolvedValue(createGridSnapshotRecord(data));
  await service().report(id, input, "report-key", "a".repeat(64));
  expect(commit.mock.calls[0]![0].revision.result).toMatchObject({ status: "actual_estimate", baselineActualMg: 100000, reportedActualMg: 500000, differenceMg: -400000 });
});
it("T09 rejects unfinished runs before any provider or mutation", async () => {
  await expect(service().report(id, { ...input, reportedStartUtc: "2026-10-21T11:30:00Z" }, "report-key", "a".repeat(64))).rejects.toMatchObject({ code: "INVALID_REPORT" });
  expect(actual).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
});
it("T09 only corrects the current report and returns retries without another provider read", async () => {
  detail.mockResolvedValue({ ...plan, latestReport: { id }, version: 2 });
  await expect(service().report(id, input, "report-key", "a".repeat(64))).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  const ack = { planId: id, planVersion: 2, reportId: id, resultId: id, changed: true, deleted: false };
  replay.mockResolvedValue(ack); expect(await service().report(id, input, "report-key", "a".repeat(64))).toEqual(ack); expect(actual).not.toHaveBeenCalled();
});
it("T09 non-execution carries null values and no grid call", async () => {
  await service().report(id, { ...input, kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null }, "report-key", "a".repeat(64));
  expect(commit.mock.calls[0]![0].revision.result).toMatchObject({ status: "did_not_run", differenceMg: null }); expect(actual).not.toHaveBeenCalled();
});
it("T09 unchanged relevant factors have stable identity despite new retrieval metadata", async () => {
  const data = snapshot(); data.retrievedAtUtc = now(); const first = createGridSnapshotRecord(data); actual.mockResolvedValue(first);
  await service().report(id, input, "report-key", "a".repeat(64)); const write = commit.mock.calls[0]![0] as LifecycleWrite;
  const next = createGridSnapshotRecord({ ...data, retrievedAtUtc: "2026-10-21T12:01:00Z" });
  const revised = { ...write.revision!, result: { ...write.revision!.result, snapshotHash: next.hash } };
  expect(resultIdentity(plan, write.report!, revised, next)).toBe(write.semantic);
  const changed = createGridSnapshotRecord({ ...data, intervals: data.intervals.map((row, i) => i === 0 ? { ...row, actualGPerKwh: 301 } : row) });
  expect(resultIdentity(plan, write.report!, revised, changed)).not.toBe(write.semantic);
});
it("T09 rejects stale refresh versions before the grid read", async () => {
  detail.mockResolvedValue({ ...plan, latestReport: { id }, latestResult: { sequence: 2 }, version: 3 });
  await expect(service().refresh(id, 1, "refresh-key", "a".repeat(64))).rejects.toMatchObject({ code: "VERSION_CONFLICT" }); expect(actual).not.toHaveBeenCalled();
});
it("T09 cancellation is separate from early non-execution and retains its note", async () => {
  const early = createLifecycleService({ repository, now: () => NOW, actual });
  await expect(early.report(id, { ...input, kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null }, "early-key", "a".repeat(64))).rejects.toMatchObject({ code: "INVALID_REPORT" });
  await early.cancel(id, "cancel-key", "b".repeat(64), "My plans changed");
  expect(commit.mock.calls[0]![0]).toMatchObject({ action: "cancel", report: { reason: "cancelled_before_start", note: "My plans changed" }, revision: { result: { status: "did_not_run", differenceMg: null } } });
});
