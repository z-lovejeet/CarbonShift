import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { createComparison } from "@/domain/scheduling";
import { calculateUpdatedResult } from "@/domain/results";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { NOW, constraints, snapshot } from "../fixtures/domain";

const url = process.env.CARBONSHIFT_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw new Error("Use the isolated integration runner.");
const sql = postgres(url, { max: 8, onnotice: () => {} });
const owner = randomUUID(), other = randomUUID();
const stamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
beforeAll(async () => { await sql`insert into auth.users(id) values(${owner}),(${other})`; });
afterAll(async () => { await sql.end(); });
async function seed(future = false) {
  let record = createGridSnapshotRecord(snapshot());
  let comp = createComparison({ constraints: constraints(), snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, NOW);
  let acceptedAt = NOW;
  if (future) {
    const offset = Math.ceil((Date.now() + 3_600_000 - Date.parse(comp.constraints.earliestStartUtc)) / 1_800_000) * 1_800_000;
    const shift = (value: string) => new Date(Date.parse(value) + offset).toISOString().replace(".000Z", "Z");
    const snap = { ...record.snapshot, retrievedAtUtc: stamp(), intervals: record.snapshot.intervals.map((interval) => ({ ...interval, fromUtc: shift(interval.fromUtc), toUtc: shift(interval.toUtc) })) };
    const next = createGridSnapshotRecord(snap);
    record = next;
    comp = createComparison({ constraints: { ...constraints(), earliestStartUtc: shift(constraints().earliestStartUtc), deadlineUtc: shift(constraints().deadlineUtc), baselineStartUtc: shift(constraints().baselineStartUtc), confirmedAtUtc: stamp() }, snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, stamp());
    acceptedAt = stamp();
  }
  const comparisonId = randomUUID(), planId = randomUUID();
  // Explicitly authored historical fixtures; never exposed through a product clock override.
  await sql`insert into grid_snapshots(id,payload_text,digest,retrieved_at) values(${record.id},${JSON.stringify(record.snapshot)},${record.hash},${record.snapshot.retrievedAtUtc})`;
  await sql`insert into comparisons(id,owner_id,snapshot_id,snapshot_hash,payload,expires_at,created_at) values(${comparisonId},${owner},${record.id},${record.hash},${sql.json(comp)},${comp.expiresAtUtc},${comp.createdAtUtc})`;
  await sql`insert into plans(id,owner_id,comparison_id,accepted_payload,accepted_at) values(${planId},${owner},${comparisonId},${sql.json(comp)},${acceptedAt})`;
  return { id: planId, comp, acceptedAt, snapshotId: record.id };
}
type Seed = Awaited<ReturnType<typeof seed>>;
function docs(plan: Seed, sequence = 1, previous: string | null = null, cancel = false) {
  const report = { schemaVersion: 1, id: randomUUID(), planId: plan.id, sequence, createdAtUtc: stamp(), kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, correctsReportId: previous, reason: cancel ? "cancelled_before_start" : previous ? "Correcting my report" : "", source: cancel ? "cancellation" : "report" };
  const result = cancel ? { status: "did_not_run", executionBasis: "self_reported", energyBasis: plan.comp.constraints.energyBasis, methodVersion: plan.comp.methodVersion, reportId: report.id, snapshotHash: null, baselineActualMg: null, reportedActualMg: null, differenceMg: null, differencePercent: null, reasonCodes: [], deviationCodes: [] } : calculateUpdatedResult({ comparison: plan.comp, acceptedAtUtc: plan.acceptedAt, report: { id: report.id, createdAtUtc: report.createdAtUtc, kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null }, actualSnapshot: null, actualSnapshotHash: null }, stamp());
  const revision = { schemaVersion: 1, id: randomUUID(), planId: plan.id, sequence, reportId: report.id, createdAtUtc: stamp(), reason: cancel ? "cancelled" : previous ? "correction" : "submitted", actualSnapshotId: null, result };
  return { report, revision };
}
type Documents = ReturnType<typeof docs>;
type LifecycleDocuments = { report: Omit<Documents["report"], "reportedStartUtc" | "profileStillApplicable"> & { reportedStartUtc: string | null; profileStillApplicable: boolean | null }; revision: Documents["revision"] };
async function commit(plan: Seed, value: LifecycleDocuments, options: { version?: number; action?: string; key?: string; digest?: string; user?: string; semantic?: string } = {}) {
  const result = await sql`select cs_lifecycle_commit(${options.user ?? owner},${plan.id},${options.action ?? "report"},${options.key ?? randomUUID()},${options.digest ?? "a".repeat(64)},${options.version ?? 1},${sql.json(value.report)},${sql.json(value.revision)},${options.semantic ?? "b".repeat(64)},null,null) ack`;
  return result[0]!.ack;
}
it("T09 atomically appends a report/result and keeps the accepted payload immutable", async () => {
  const plan = await seed(), values = docs(plan);
  const ack = await commit(plan, values);
  expect(ack).toMatchObject({ planVersion: 2, reportId: values.report.id, resultId: values.revision.id, changed: true });
  expect((await sql`select accepted_payload from plans where id=${plan.id}`)[0]!.accepted_payload).toEqual(plan.comp);
  await expect(sql`update completion_reports set reason='overwrite' where plan_id=${plan.id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" });
  await expect(sql`update result_revisions set document='{}' where plan_id=${plan.id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" });
});
it("T09 serializes same-key retries and concurrent corrections without losing history", async () => {
  const plan = await seed(), first = docs(plan), key = randomUUID();
  const replies = await Promise.all(Array.from({ length: 5 }, () => commit(plan, first, { key })));
  expect(new Set(replies.map((reply) => reply.resultId)).size).toBe(1);
  const corrections = await Promise.allSettled(Array.from({ length: 4 }, () => commit(plan, docs(plan, 2, first.report.id), { version: 2 })));
  expect(corrections.filter((value) => value.status === "fulfilled")).toHaveLength(1);
  expect(corrections.filter((value) => value.status === "rejected").every((value) => value.reason.message === "VERSION_CONFLICT")).toBe(true);
  expect((await sql`select sequence from completion_reports where plan_id=${plan.id} order by sequence`).map((row) => row.sequence)).toEqual([1, 2]);
  expect(await commit(plan, first, { key })).toEqual(replies[0]);
  await expect(commit(plan, first, { key, digest: "c".repeat(64) })).rejects.toMatchObject({ message: "IDEMPOTENCY_CONFLICT" });
});
it("T09 rejects stale report references and foreign ownership", async () => {
  const plan = await seed(), first = docs(plan); await commit(plan, first);
  await expect(commit(plan, docs(plan, 2), { version: 2 })).rejects.toMatchObject({ message: "VERSION_CONFLICT" });
  await expect(commit(plan, first, { user: other })).rejects.toMatchObject({ message: "NOT_FOUND" });
});
it("T09 retains the result revision for an unchanged refresh", async () => {
  const plan = await seed(), values = docs(plan); const first = await commit(plan, values);
  const refresh = { ...values, revision: { ...values.revision, id: randomUUID(), sequence: 2, reason: "refresh" } };
  const response = await commit(plan, refresh, { version: 2, action: "refresh" });
  expect(response).toEqual({ ...first, changed: false });
  expect(await sql`select id from result_revisions where plan_id=${plan.id}`).toHaveLength(1);
});
it("T09 cancellation is terminal and never produces numeric savings", async () => {
  const plan = await seed(true), values = docs(plan, 1, null, true); await commit(plan, values, { action: "cancel" });
  expect((await sql`select status from plans where id=${plan.id}`)[0]!.status).toBe("cancelled");
  expect((await sql`select document->'result'->'differenceMg' amount from result_revisions where plan_id=${plan.id}`)[0]!.amount).toBeNull();
  await expect(commit(plan, values, { version: 2 })).rejects.toMatchObject({ message: "PLAN_CANCELLED" });
});
it("T09 deletes private history and orphan data, and can replay the deletion acknowledgement", async () => {
  const plan = await seed(), values = docs(plan); await commit(plan, values);
  const key = randomUUID(); const ack = await commit(plan, values, { action: "delete", version: 2, key });
  expect(ack.deleted).toBe(true);
  expect(await sql`select id from completion_reports where plan_id=${plan.id}`).toHaveLength(0);
  expect(await sql`select id from grid_snapshots where id=${plan.snapshotId}`).toHaveLength(0);
  expect(await commit(plan, values, { action: "delete", version: 2, key })).toEqual(ack);
});
it("T02/T09 denies direct member writes and hides foreign history", async () => {
  const plan = await seed(); await commit(plan, docs(plan));
  await sql.begin(async (db) => {
    await db`select set_config('request.jwt.claim.sub',${other},true)`; await db.unsafe("set local role authenticated");
    expect(await db`select id from completion_reports where plan_id=${plan.id}`).toHaveLength(0);
    expect(await db`select id from result_revisions where plan_id=${plan.id}`).toHaveLength(0);
  });
  for (const table of ["completion_reports", "result_revisions", "lifecycle_mutations"]) {
    await expect(sql.begin(async (db) => { await db.unsafe("set local role authenticated"); await db.unsafe(`delete from ${table}`); })).rejects.toMatchObject({ code: "42501" });
  }
});
it("T09 rolls back both append-only rows when the acknowledgement write fails", async () => {
  const plan = await seed();
  await sql.unsafe("create function public.test_reject_lifecycle() returns trigger language plpgsql as $$ begin raise exception 'TEST_LIFECYCLE_FAILURE'; end $$; create trigger test_reject_lifecycle before insert on lifecycle_mutations for each row execute function public.test_reject_lifecycle()");
  try {
    await expect(commit(plan, docs(plan))).rejects.toMatchObject({ message: "TEST_LIFECYCLE_FAILURE" });
    expect(await sql`select id from completion_reports where plan_id=${plan.id}`).toHaveLength(0);
    expect((await sql`select version from plans where id=${plan.id}`)[0]!.version).toBe(1);
  } finally { await sql.unsafe("drop trigger test_reject_lifecycle on lifecycle_mutations; drop function public.test_reject_lifecycle()"); }
});
it("T09 account deletion cascades private data and keeps unrelated owners", async () => {
  const isolated = randomUUID(); await sql`insert into auth.users(id) values(${isolated})`;
  const plan = await seed(); await commit(plan, docs(plan));
  await sql`delete from auth.users where id=${owner}`;
  expect(await sql`select id from plans where owner_id=${owner}`).toHaveLength(0);
  expect(await sql`select id from auth.users where id=${other}`).toHaveLength(1);
  await sql`delete from auth.users where id=${isolated}`;
});
it("T02/T09 reads one owner-only consistent plan/history snapshot", async () => {
  await sql`insert into auth.users(id) values(${owner})`;
  const plan = await seed(); const value = docs(plan); await commit(plan, value);
  for (const user of [owner, other]) await sql.begin(async (db) => {
    await db`select set_config('request.jwt.claim.sub',${user},true)`; await db.unsafe("set local role authenticated");
    const rows = await db`select cs_read_private_plan(${plan.id}) data`;
    if (user === other) expect(rows[0]!.data).toBeNull();
    else expect(rows[0]!.data).toMatchObject({ plan: { version: 2 }, reports: [{ id: value.report.id }], revisions: [{ reportId: value.report.id }] });
  });
});
it("T08/T09 persists actual snapshots with owner RLS and deduplicates unchanged refreshes", async () => {
  const plan = await seed(), stampUtc = stamp();
  const actual = createGridSnapshotRecord({ ...snapshot([100, 100, 200, 200, 500, 500, 300, 300]), retrievedAtUtc: stampUtc });
  const report = { ...docs(plan).report, createdAtUtc: stampUtc, kind: "ran", reportedStartUtc: plan.comp.selected.startUtc, profileStillApplicable: true };
  const result = calculateUpdatedResult({ comparison: plan.comp, acceptedAtUtc: plan.acceptedAt, report: { id: report.id, createdAtUtc: report.createdAtUtc, kind: "ran", reportedStartUtc: report.reportedStartUtc, profileStillApplicable: true }, actualSnapshot: actual.snapshot, actualSnapshotHash: actual.hash }, stampUtc);
  const revision = { ...docs(plan).revision, reportId: report.id, actualSnapshotId: actual.id, result };
  const rows = await sql`select cs_lifecycle_commit(${owner},${plan.id},'report',${randomUUID()},${"a".repeat(64)},1,${sql.json(report)},${sql.json(revision)},${"b".repeat(64)},${JSON.stringify(actual.snapshot)},${actual.hash}) ack`;
  expect(result.differenceMg).toBe(-400000);
  for (const user of [owner, other]) await sql.begin(async (db) => {
    await db`select set_config('request.jwt.claim.sub',${user},true)`; await db.unsafe("set local role authenticated");
    expect(await db`select id from grid_snapshots where id=${actual.id}`).toHaveLength(user === owner ? 1 : 0);
  });
  const retrievedAgain = createGridSnapshotRecord(actual.snapshot);
  const next = { ...revision, id: randomUUID(), sequence: 2, reason: "refresh", actualSnapshotId: retrievedAgain.id };
  const refreshed = await sql`select cs_lifecycle_commit(${owner},${plan.id},'refresh',${randomUUID()},${"a".repeat(64)},2,null,${sql.json(next)},${"b".repeat(64)},${JSON.stringify(retrievedAgain.snapshot)},${retrievedAgain.hash}) ack`;
  expect(refreshed[0]!.ack).toEqual({ ...rows[0]!.ack, changed: false });
  expect(await sql`select id from grid_snapshots where id=${retrievedAgain.id}`).toHaveLength(0);
  const changed = createGridSnapshotRecord({ ...actual.snapshot, intervals: actual.snapshot.intervals.map((interval, i) => i === 4 ? { ...interval, actualGPerKwh: 501 } : interval) });
  const changedResult = calculateUpdatedResult({ comparison: plan.comp, acceptedAtUtc: plan.acceptedAt, report: { id: report.id, createdAtUtc: report.createdAtUtc, kind: "ran", reportedStartUtc: report.reportedStartUtc, profileStillApplicable: true }, actualSnapshot: changed.snapshot, actualSnapshotHash: changed.hash }, stampUtc);
  const changedRevision = { ...next, actualSnapshotId: changed.id, result: changedResult };
  const updated = await sql`select cs_lifecycle_commit(${owner},${plan.id},'refresh',${randomUUID()},${"a".repeat(64)},2,null,${sql.json(changedRevision)},${"c".repeat(64)},${JSON.stringify(changed.snapshot)},${changed.hash}) ack`;
  expect(updated[0]!.ack).toMatchObject({ changed: true, planVersion: 3, resultId: changedRevision.id });
  expect(await sql`select id from result_revisions where plan_id=${plan.id}`).toHaveLength(2);
  await commit(plan, docs(plan), { action: "delete", version: 3 });
  expect(await sql`select id from grid_snapshots where id in (${actual.id},${changed.id})`).toHaveLength(0);
});
it("T09 a changed-profile correction retains prior history and suppresses new amounts", async () => {
  const plan = await seed(), first = docs(plan); await commit(plan, first);
  const report = { ...docs(plan, 2, first.report.id).report, kind: "ran", reportedStartUtc: plan.comp.selected.startUtc, profileStillApplicable: false };
  const result = calculateUpdatedResult({ comparison: plan.comp, acceptedAtUtc: plan.acceptedAt, report: { id: report.id, createdAtUtc: report.createdAtUtc, kind: "ran", reportedStartUtc: report.reportedStartUtc, profileStillApplicable: false }, actualSnapshot: null, actualSnapshotHash: null }, stamp());
  const revision = { ...docs(plan, 2, first.report.id).revision, reportId: report.id, result };
  await commit(plan, { report, revision }, { version: 2 });
  expect(result).toMatchObject({ status: "outside_supported_window", reasonCodes: ["PROFILE_CHANGED"], differenceMg: null });
  expect(await sql`select id from completion_reports where plan_id=${plan.id}`).toHaveLength(2);
});
