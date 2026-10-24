import { beforeAll, afterAll, it, expect } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { scheduleDatabaseFixture, fixtureDigest } from "../fixtures/schedule-db";
import { buildActivityPlan, buildActivityResult } from "@/server/proof/activity-builders";
import { createProofIdentity } from "@/server/proof/identity";
import { canonicalV2, hashPlanV2, hashResultV2 } from "@/domain/proof/v2/canonical";
import { ZERO_HASH } from "@/domain/proof/schemas";
import { scheduleReportSchema, taskResultSchema } from "@/contracts/schedule-lifecycle";
const url = process.env.CARBONSHIFT_TEST_DATABASE_URL; if (!url || new URL(url).hostname !== "127.0.0.1") throw new Error("Use isolated database runner");
const sql = postgres(url, { max: 8, onnotice: () => {} }), owner = randomUUID(), foreign = randomUUID();
beforeAll(async () => { await sql`insert into auth.users(id) values(${owner}),(${foreign})`; }); afterAll(async () => { await sql.end(); });
async function reported() { const plan = await scheduleDatabaseFixture(sql, owner), taskId = plan.comparison.input.tasks[0]!.activity.id, stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), report = scheduleReportSchema.parse({ schemaVersion: 2, id: randomUUID(), scheduleId: plan.id, taskId, sequence: 1, previousReportId: null, kind: "did_not_run", actualStartUtc: null, profileUnchanged: null, reportedAtUtc: stamp }), result = taskResultSchema.parse({ schemaVersion: 2, id: randomUUID(), scheduleId: plan.id, taskId, reportId: report.id, sequence: 1, calculatedAtUtc: stamp, state: "did_not_run", baselineActualMg: null, reportedActualMg: null, differenceMg: null, deviationCodes: [], grid: null }); const key = randomUUID(), digest = fixtureDigest(report.id), semantic = fixtureDigest('semantic:'+report.id); const commit = () => sql`select cs_schedule_report_commit(${owner},${plan.id},${taskId},'report',${key},${digest},0,${sql.json(report)},${sql.json(result)},${semantic}) as ack`; const ack = (await commit())[0]!.ack; return { plan, report, result, taskId, key, digest, semantic, ack, commit }; }
it("appends a report/result atomically, deduplicates retries and unchanged refresh", async () => { const f = await reported(); expect((await f.commit())[0]!.ack).toEqual(f.ack); const next = { ...f.result, id: randomUUID(), sequence: 2 }; const refresh = (await sql`select cs_schedule_report_commit(${owner},${f.plan.id},${f.taskId},'refresh',${randomUUID()},${fixtureDigest('refresh')},1,null,${sql.json(next)},${f.semantic}) as ack`)[0]!.ack; expect(refresh.unchanged).toBe(true); expect(await sql`select id from schedule_results where schedule_id=${f.plan.id}`).toHaveLength(1); await expect(sql`select cs_schedule_report_commit(${foreign},${f.plan.id},${f.taskId},'report',${randomUUID()},${f.digest},0,${sql.json(f.report)},${sql.json(f.result)},${f.semantic})`).rejects.toMatchObject({ message: "NOT_FOUND" }); });
it("rejects conflicting corrections and keeps history immutable", async () => { const f = await reported(); await expect(sql`update schedule_reports set payload=payload where id=${f.report.id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" }); await expect(sql`select cs_schedule_report_commit(${owner},${f.plan.id},${f.taskId},'report',${randomUUID()},${f.digest},0,${sql.json({ ...f.report, id: randomUUID() })},${sql.json(f.result)},${f.semantic})`).rejects.toMatchObject({ message: "VERSION_CONFLICT" }); });
it("publishes exact sanitized v2 copies into the shared outbox and retains them on private deletion", async () => {
  const f = await reported(), identity = { ...createProofIdentity(), contractAddress: '0x'+'12'.repeat(20) };
  await sql`select cs_schedule_receipt_identity(${owner},${f.plan.id},${identity.receiptId},${identity.nonce},${identity.contractAddress})`;
  const manifest = buildActivityPlan(f.plan, identity), hash = hashPlanV2(manifest); expect(canonicalV2(manifest)).not.toContain('Private routine'); expect(canonicalV2(manifest)).not.toContain('private-0');
  const preview = (await sql`select cs_schedule_publication_preview(${owner},${f.plan.id},${canonicalV2(manifest)},${hash},null) as p`)[0]!.p, key = randomUUID(), digest = fixtureDigest('publication');
  const ack = (await sql`select cs_schedule_publication_consent(${owner},${f.plan.id},${preview.id},${hash},${key},${digest}) as ack`)[0]!.ack;
  expect((await sql`select cs_schedule_publication_consent(${owner},${f.plan.id},${preview.id},${hash},${key},${digest}) as ack`)[0]!.ack).toEqual(ack);
  await expect(sql`select cs_schedule_publication_consent(${foreign},${f.plan.id},${preview.id},${hash},${randomUUID()},${digest})`).rejects.toMatchObject({ message: "NOT_FOUND" });
  // Isolated delivery-state injection only; actual contract delivery is checked separately.
  await sql`update ledger_operations set status='confirmed' where id=${ack.operationId}`;
  const result = buildActivityResult(f.plan, { schemaVersion: 2, reports: [f.report], results: [f.result] }, manifest, { nonce: createProofIdentity().nonce, publicRevision: 1, previousResultHash: ZERO_HASH, correctionExplanation: '' }), vector = (await sql`select cs_schedule_vector(${f.plan.id}) as vector`)[0]!.vector;
  const resultPreview = (await sql`select cs_schedule_publication_preview(${owner},${f.plan.id},${canonicalV2(result)},${hashResultV2(result)},${sql.json(vector)}) as p`)[0]!.p;
  const resultAck = (await sql`select cs_schedule_publication_consent(${owner},${f.plan.id},${resultPreview.id},${hashResultV2(result)},${randomUUID()},${fixtureDigest('result')}) as ack`)[0]!.ack;
  await sql`delete from schedules where id=${f.plan.id}`;
  const retained = (await sql`select schedule_id,owner_id,manifest_hash from publications where receipt_id=${identity.receiptId}`)[0]!; expect(retained).toMatchObject({ schedule_id: null, owner_id: null, manifest_hash: hash }); expect((await sql`select status from ledger_operations where id=${resultAck.operationId}`)[0]!.status).toBe('failed');
});
