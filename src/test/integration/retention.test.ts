import { afterAll, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { createComparison } from "@/domain/scheduling";
import { calculateSchedule } from "@/server/schedules/calculation";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { buildPlanManifest } from "@/server/proof/builders";
import { createProofIdentity } from "@/server/proof/identity";
import { canonicalJson, hashPlan } from "@/domain/proof";
import { planSchema } from "@/contracts/planning";
import { constraints, snapshot } from "../fixtures/domain";

const url = process.env.CARBONSHIFT_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw new Error("Use the isolated integration runner.");
const sql = postgres(url, { max: 3, onnotice: () => {} });
afterAll(() => sql.end());
const iso = (n: number) => new Date(n).toISOString().replace(/\.\d{3}Z$/, "Z");

// Trusted historical records are seeded directly in the disposable database only.
async function historical(owner: string, days: number, accepted = true) {
  const now = Math.floor(Date.now() / 1000) * 1000 - days * 86400000;
  const first = Math.ceil((now + 7200000) / 1800000) * 1800000;
  const source = snapshot(); source.retrievedAtUtc = iso(now);
  source.intervals = source.intervals.map((row, i) => ({ ...row, fromUtc: iso(first + i * 1800000), toUtc: iso(first + (i + 1) * 1800000) }));
  const record = createGridSnapshotRecord(source), id = randomUUID();
  const comparison = createComparison({ constraints: { ...constraints(), earliestStartUtc: iso(first), deadlineUtc: iso(first + 14400000), baselineStartUtc: iso(first), confirmedAtUtc: iso(now) }, snapshot: source, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, iso(now));
  await sql`insert into grid_snapshots(id,payload_text,digest,retrieved_at,created_at) values(${record.id},${JSON.stringify(source)},${record.hash},${iso(now)},${iso(now)})`;
  await sql`insert into comparisons(id,owner_id,snapshot_id,snapshot_hash,payload,created_at,expires_at) values(${id},${owner},${record.id},${record.hash},${sql.json(comparison)},${comparison.createdAtUtc},${comparison.expiresAtUtc})`;
  const planId = randomUUID();
  if (accepted) await sql`insert into plans(id,owner_id,comparison_id,accepted_payload,accepted_at) values(${planId},${owner},${id},${sql.json(comparison)},${iso(now + 1000)})`;
  const v2 = await calculateSchedule({ constraintsConfirmed: true, input: { schemaVersion: 2, kind: "tasks", geography: "GB_NATIONAL", timezone: "Europe/London", dayDate: null, tasks: [{ activity: { schemaVersion: 2, id: "tv", category: "television", name: "Authored retention fixture", durationMinutes: 15, quantity: 1, energy: { kind: "average_power", powerMw: 100000, origin: "user_estimate", confirmed: true } }, baselineStartUtc: iso(first), windows: [{ startUtc: iso(first), endUtc: iso(first + 3600000) }], blocks: [], fixedStartUtc: null, resourceIds: [], predecessorIds: [], requiresAttention: false }] } }, { getForecast: async () => record, getActual: async () => record }, () => iso(now));
  await sql`insert into schedule_comparisons(id,owner_id,payload,created_at,expires_at) values(${v2.id},${owner},${sql.json(v2)},${v2.createdAtUtc},${v2.expiresAtUtc})`;
  const scheduleId = randomUUID();
  if (accepted) {
    await sql`insert into schedules(id,owner_id,comparison_id,accepted_payload,option_index,accepted_at) values(${scheduleId},${owner},${v2.id},${sql.json(v2)},0,${iso(now+1000)})`;
    await sql`insert into schedule_tasks(schedule_id,owner_id,task_id,payload) values(${scheduleId},${owner},'tv',${sql.json({ input: v2.input.tasks[0] })})`;
  }
  return { planId, scheduleId, v1: id, v2: v2.id, snapshot: record.id, plan: planSchema.parse({ schemaVersion: 1, id: planId, comparisonId: id, version: 1, status: "accepted", mode: "live", acceptedAtUtc: iso(now+1000), comparison, forecastSnapshot: source, publication: "private", completion: "not_reported", reports: [], revisions: [], latestReport: null, latestResult: null }) };
}

it("previews without deleting, applies expired private retention and preserves public/signed/current records", async () => {
  const owner = randomUUID(); await sql`insert into auth.users(id) values(${owner})`;
  const old = await historical(owner, 31), current = await historical(owner, 1), unused = await historical(owner, 2, false), retained = await historical(owner, 32);
  const manifest = buildPlanManifest(retained.plan, { ...createProofIdentity(), contractAddress: "0x"+"ba".repeat(20) }), hash = hashPlan(manifest);
  const [publication] = await sql`insert into publications(plan_id,owner_id,receipt_id,manifest,canonical_text,manifest_hash,consent_version) values(${retained.planId},${owner},${manifest.receiptId},${sql.json(manifest)},${canonicalJson(manifest)},${hash},'public-proof-v1') returning id`;
  const [operation] = await sql`insert into ledger_operations(publication_id,kind,expected_hash,status) values(${publication!.id},'plan',${hash},'submitted') returning id`;
  await sql`insert into ledger_signed_transactions(operation_id,signer,chain_id,nonce,raw_transaction,transaction_hash) values(${operation!.id},${'0x'+randomUUID().replaceAll('-','').padEnd(40,'0')},11155111,0,'0x01',${'0x'+randomUUID().replaceAll('-','').padEnd(64,'0')})`;
  // A v2 consented copy also protects its private parent, even when only queued.
  // Use a fully valid v2 projection instead of weakening public-copy constraints.
  const { buildActivityPlan } = await import("@/server/proof/activity-builders");
  const { canonicalV2, hashPlanV2 } = await import("@/domain/proof/v2/canonical");
  const saved = (await sql`select accepted_payload,accepted_at from schedules where id=${retained.scheduleId}`)[0]!;
  const v2Manifest = buildActivityPlan({ schemaVersion: 2, id: retained.scheduleId, acceptedAtUtc: iso(new Date(saved.accepted_at).getTime()), comparison: saved.accepted_payload, optionIndex: 0, publicationStatus: "private" }, { ...createProofIdentity(), contractAddress: manifest.contractAddress });
  await sql`insert into publications(schedule_id,owner_id,receipt_id,manifest,canonical_text,manifest_hash,consent_version) values(${retained.scheduleId},${owner},${v2Manifest.receiptId},${sql.json(v2Manifest)},${canonicalV2(v2Manifest)},${hashPlanV2(v2Manifest)},'public-proof-v2')`;
  const [dry] = await sql`select cs_retention(false) as result`;
  expect(dry!.result).toMatchObject({ mode: "dry-run", busy: false });
  expect(dry!.result.eligible.privatePlans).toBeGreaterThanOrEqual(1);
  expect(await sql`select id from plans where id=${old.planId}`).toHaveLength(1);
  const [applied] = await sql`select cs_retention(true) as result`;
  expect(applied!.result.removed.privatePlans).toBeGreaterThanOrEqual(1);
  expect(await sql`select id from plans where id=${old.planId}`).toHaveLength(0);
  expect(await sql`select id from schedules where id=${old.scheduleId}`).toHaveLength(0);
  expect(await sql`select task_id from schedule_tasks where schedule_id=${old.scheduleId}`).toHaveLength(0);
  expect(await sql`select id from comparisons where id in (${old.v1},${unused.v1})`).toHaveLength(0);
  expect(await sql`select id from schedule_comparisons where id in (${old.v2},${unused.v2})`).toHaveLength(0);
  expect(await sql`select id from plans where id in (${retained.planId},${current.planId})`).toHaveLength(2);
  expect(await sql`select id from schedules where id in (${retained.scheduleId},${current.scheduleId})`).toHaveLength(2);
  expect(await sql`select operation_id from ledger_signed_transactions where operation_id=${operation!.id}`).toHaveLength(1);
  expect(await sql`select manifest_hash from publications where id=${publication!.id}`).toEqual([{ manifest_hash: hash }]);
});

it.each(["anon", "authenticated"])("denies %s direct maintenance execution", async (role) => {
  await expect(sql.begin(async (db) => { await db.unsafe(`set local role ${role}`); await db`select cs_retention(true)`; })).rejects.toMatchObject({ code: "42501" });
});
