import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireMember } from "@/server/auth/session";
import { assertRecentReauth } from "@/server/auth/reauth";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { readJson, assertSameOrigin } from "@/server/http/request";
import { ApiError, publicFailure } from "@/server/http/errors";
import { mutationIngress } from "@/server/limits/ingress";
import { canonicalJson, digest } from "@/server/limits/budgets";
import { databaseError } from "@/server/plans/repository";
import { createScheduleRepository } from "./repository";
import { lifecycleAckV2Schema, scheduleReportSchema, scheduleReportRequestSchema, taskResultSchema, type ScheduleReport } from "@/contracts/schedule-lifecycle";
import { parseDomain } from "@/domain/errors";
import { taskResultAmounts } from "@/domain/activities/results";
import { halfHourCoverage, addSeconds } from "@/domain/time";
import { gridClient } from "@/server/grid";
import type { GridSnapshotRecord } from "@/server/grid/snapshot";
import type { Json } from "@/server/db/schema";
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
export async function scheduleLifecycle(request: Request, scheduleId: string, action: "report" | "refresh" | "history" | "delete", taskId?: string) {
  const requestId = randomUUID();
  try {
    const config = databaseConfiguration(); if (request.method !== "GET") assertSameOrigin(request, config.origin);
    const member = await requireMember(), writer = createServiceClient(); await mutationIngress(member.userId);
    if (!z.uuid().safeParse(scheduleId).success) throw new ApiError("NOT_FOUND", 404, "This schedule was not found.");
    const repository = createScheduleRepository(member.client, writer, member.userId), plan = await repository.detail(scheduleId);
    if (action === "delete") {
      await assertRecentReauth(request, member);
      const deleted = await writer.from("schedules").delete().eq("id", scheduleId).eq("owner_id", member.userId); databaseError(deleted.error);
      return Response.json({ data: { deleted: true }, requestId }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const history = await repository.history(scheduleId);
    if (action === "history") return Response.json({ data: history, requestId }, { headers: { "Cache-Control": "private, no-store" } });
    const task = plan.comparison.input.tasks.find((t) => t.activity.id === taskId), activity = plan.comparison.activities.find((a) => a.input.id === taskId);
    if (!task || !activity) throw new ApiError("NOT_FOUND", 404, "This task was not found.");
    const key = z.uuid().safeParse(request.headers.get("Idempotency-Key")); if (!key.success) throw new ApiError("INVALID_INPUT", 422, "Use a valid retry key.");
    const input = action === "report" ? parseDomain(scheduleReportRequestSchema, await readJson(request)) : parseDomain(z.strictObject({ expectedResultSequence: z.number().int().min(1) }), await readJson(request));
    const requestDigest = digest(canonicalJson({ action, scheduleId, taskId, input })), scope = `${action}:${taskId}`;
    const replay = await writer.from("schedule_lifecycle_keys").select("digest,response,schedule_id").eq("owner_id", member.userId).eq("scope", scope).eq("key", key.data).maybeSingle(); databaseError(replay.error);
    if (replay.data) {
      if (replay.data.digest !== requestDigest || replay.data.schedule_id !== scheduleId) throw new ApiError("IDEMPOTENCY_CONFLICT", 409, "This retry key belongs to a different request.");
      return Response.json({ data: lifecycleAckV2Schema.parse(replay.data.response), requestId }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const latestReport = history.reports.filter((r) => r.taskId === taskId).at(-1), latestResult = history.results.filter((r) => r.taskId === taskId).at(-1);
    let report: ScheduleReport, expected: number;
    if (action === "report") {
      const body = scheduleReportRequestSchema.parse(input); expected = body.expectedReportSequence;
      if (expected !== (latestReport?.sequence ?? 0) || body.correctsReportId !== (latestReport?.id ?? null)) throw new ApiError("VERSION_CONFLICT", 409, "A newer task report exists. Reload before correcting it.");
      report = scheduleReportSchema.parse({ schemaVersion: 2, id: randomUUID(), scheduleId, taskId, sequence: expected + 1, previousReportId: latestReport?.id ?? null, kind: body.kind, actualStartUtc: body.actualStartUtc, profileUnchanged: body.profileUnchanged, reportedAtUtc: stamp() });
    } else {
      expected = z.object({ expectedResultSequence: z.number() }).parse(input).expectedResultSequence;
      if (!latestReport || latestResult?.sequence !== expected) throw new ApiError("VERSION_CONFLICT", 409, "Report this task first, or reload its newer result.");
      report = latestReport;
    }
    let grid: GridSnapshotRecord | null = null;
    let amounts = taskResultAmounts(plan, report, null, stamp());
    if (amounts.state === "pending" && report.actualStartUtc) {
      const from = [task.baselineStartUtc, report.actualStartUtc].sort()[0]!, to = [addSeconds(task.baselineStartUtc, activity.durationSeconds), addSeconds(report.actualStartUtc, activity.durationSeconds)].sort().at(-1)!;
      try { grid = await gridClient.getActual(halfHourCoverage(from, to)); } catch { /* A report remains durable while factors are missing. */ }
      amounts = taskResultAmounts(plan, report, grid?.snapshot ?? null, stamp());
    }
    const result = taskResultSchema.parse({ ...amounts, schemaVersion: 2, id: randomUUID(), scheduleId, taskId, reportId: report.id, sequence: (latestResult?.sequence ?? 0) + 1, calculatedAtUtc: stamp(), grid });
    const semantic = digest(canonicalJson({ reportId: report.id, ...amounts, factors: grid?.snapshot.intervals.filter((i) => report.actualStartUtc && ((i.fromUtc < addSeconds(report.actualStartUtc, activity.durationSeconds) && i.toUtc > report.actualStartUtc) || (i.fromUtc < addSeconds(task.baselineStartUtc, activity.durationSeconds) && i.toUtc > task.baselineStartUtc))).map((i) => ({ fromUtc: i.fromUtc, toUtc: i.toUtc, actualGPerKwh: i.actualGPerKwh })) ?? [] }));
    const committed = await writer.rpc("cs_schedule_report_commit", { p_owner: member.userId, p_schedule: scheduleId, p_task: taskId!, p_action: action, p_key: key.data, p_digest: requestDigest, p_expected: expected, p_report: (action === "report" ? report : null) as unknown as Json, p_result: result, p_semantic: semantic }); databaseError(committed.error);
    return Response.json({ data: lifecycleAckV2Schema.parse(committed.data), requestId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return publicFailure(e, requestId); }
}
