import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { publicationFixture, dbDigest } from "../fixtures/publication-db";
import { buildResultManifest } from "@/server/proof/builders";
import { createProofIdentity } from "@/server/proof/identity";
import { canonicalJson, hashResult, ZERO_HASH } from "@/domain/proof";
import { reportDocumentSchema, resultRevisionSchema } from "@/contracts/lifecycle";

const url = process.env.CARBONSHIFT_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw new Error("Use the isolated integration runner.");
const sql = postgres(url, { max: 10, onnotice: () => {} }), A = randomUUID(), B = randomUUID();
beforeAll(async () => { await sql`insert into auth.users(id) values (${A}),(${B})`; });
afterAll(async () => { await sql.end(); });
async function member(owner: string, query: (db: postgres.TransactionSql) => Promise<unknown>) {
  return sql.begin(async (db) => { await db`select set_config('request.jwt.claim.sub',${owner},true)`; await db.unsafe("set local role authenticated"); return query(db); });
}
it("persists identity and reuses immutable preview bytes across concurrent tabs", async () => {
  const f = await publicationFixture(sql, A), previews = await Promise.all(Array.from({ length: 4 }, () => f.preview()));
  expect(new Set(previews.map((p) => p.id)).size).toBe(1);
  expect(previews[0].manifest).toEqual(f.manifest);
  expect(await sql`select id from publications where plan_id=${f.plan.id}`).toHaveLength(0);
  await expect(sql`update publication_previews set manifest=manifest where id=${previews[0].id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" });
});
it("queues exactly one operation under same and different-key publication retries", async () => {
  const f = await publicationFixture(sql, A), preview = await f.preview(), key = randomUUID();
  const acks = await Promise.all(Array.from({ length: 6 }, (_, i) => f.consent(preview, i < 3 ? key : randomUUID())));
  expect(new Set(acks.map((a) => a.operationId)).size).toBe(1);
  expect(await sql`select id from ledger_operations where id=${acks[0].operationId}`).toHaveLength(1);
  await expect(f.consent(preview, key, dbDigest("changed"))).rejects.toMatchObject({ message: "IDEMPOTENCY_CONFLICT" });
});
it("rejects foreign ownership, hash changes, stale versions and mismatched route revision", async () => {
  const f = await publicationFixture(sql, A), preview = await f.preview();
  await expect(f.consent(preview, randomUUID(), undefined, B)).rejects.toMatchObject({ message: "NOT_FOUND" });
  await expect(f.consent({ ...preview, manifest_hash: "0x" + "b".repeat(64) })).rejects.toMatchObject({ message: "PREVIEW_CHANGED" });
  await expect(sql`select cs_publication_consent(${A},${f.plan.id},${preview.id},${preview.manifest_hash},'public-proof-v1',${randomUUID()},${dbDigest("route")},1)`).rejects.toMatchObject({ message: "PREVIEW_CHANGED" });
  await sql`update plans set version=version+1 where id=${f.plan.id}`;
  await expect(f.consent(preview)).rejects.toMatchObject({ message: "PREVIEW_CHANGED" });
  expect(await sql`select id from publications where plan_id=${f.plan.id}`).toHaveLength(0);
});
it("rejects expired previews while allowing replay of an already accepted command", async () => {
  const owner = randomUUID(); await sql`insert into auth.users(id) values(${owner})`;
  const f = await publicationFixture(sql, owner), preview = await f.preview(), key = randomUUID(), ack = await f.consent(preview, key);
  // Isolated fault injection only: immutable product functions have no clock override.
  await sql.unsafe("alter table publication_previews disable trigger preview_immutable");
  try { await sql`update publication_previews set created_at=clock_timestamp()-interval '10 minutes',expires_at=clock_timestamp()-interval '1 minute' where id=${preview.id}`; }
  finally { await sql.unsafe("alter table publication_previews enable trigger preview_immutable"); }
  expect(await f.consent(preview, key)).toEqual(ack);
  await expect(f.consent(preview)).rejects.toMatchObject({ message: "PREVIEW_CHANGED" });
});
it("enforces the daily commitment cap without charging identical retries", async () => {
  const owner = randomUUID(); await sql`insert into auth.users(id) values(${owner})`;
  for (let i = 0; i < 5; i++) { const f = await publicationFixture(sql, owner), p = await f.preview(); await f.consent(p); await f.consent(p); }
  const extra = await publicationFixture(sql, owner);
  await expect(extra.consent(await extra.preview())).rejects.toMatchObject({ message: "PUBLICATION_RATE_LIMITED" });
});
it("keeps public copies immutable and restricts direct publication/signing table access", async () => {
  const f = await publicationFixture(sql, B), ack = await f.consent(await f.preview());
  expect(await member(A, (db) => db`select id from ledger_operations where id=${ack.operationId}`)).toEqual([]);
  expect(await member(B, (db) => db`select id from ledger_operations where id=${ack.operationId}`)).toHaveLength(1);
  for (const table of ["publications", "published_results", "publication_previews", "ledger_signed_transactions", "ledger_worker_leases"]) {
    await expect(member(B, (db) => db.unsafe(`insert into public.${table} default values`))).rejects.toMatchObject({ code: "42501" });
  }
  await expect(member(B, (db) => db`select * from ledger_signed_transactions`)).rejects.toMatchObject({ code: "42501" });
  await expect(member(B, (db) => db`select cs_publication_identity(${B},${f.plan.id},'x','x','x')`)).rejects.toMatchObject({ code: "42501" });
  await expect(sql`delete from publications where plan_id=${f.plan.id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" });
  await expect(sql`delete from plans where id=${f.plan.id}`).rejects.toMatchObject({ message: "PUBLISHED_PLAN_RETAINED" });
});
it("serializes leases and rejects stale fencing identities", async () => {
  const scope = "11155111:0x" + "b1".repeat(20), holder = randomUUID(), other = randomUUID();
  const first = (await sql`select cs_ledger_lease(${scope},${holder}) as token`)[0]!.token;
  expect((await sql`select cs_ledger_lease(${scope},${other}) as token`)[0]!.token).toBeNull();
  await sql`update ledger_worker_leases set expires_at=clock_timestamp()-interval '1 second' where scope=${scope}`;
  const second = (await sql`select cs_ledger_lease(${scope},${other}) as token`)[0]!.token;
  expect(Number(second)).toBeGreaterThan(Number(first));
  await expect(sql`select cs_ledger_assert_lease(${scope},${holder},${first})`).rejects.toMatchObject({ message: "LEASE_LOST" });
});
it("cancellation stops unsigned work; durable signed bytes survive cancellation and account removal", async () => {
  for (const signed of [false, true]) {
    const owner = randomUUID(); await sql`insert into auth.users(id) values(${owner})`;
    const f = await publicationFixture(sql, owner), ack = await f.consent(await f.preview());
    const scope = "11155111:0x" + (signed ? "c1" : "d1").repeat(20), holder = randomUUID();
    const token = (await sql`select cs_ledger_lease(${scope},${holder}) as token`)[0]!.token;
    expect((await sql`select cs_ledger_prepare(${ack.operationId},${scope},${holder},${token}) as prepared`)[0]!.prepared).toBe(true);
    if (signed) expect((await sql`select cs_ledger_persist_signed(${ack.operationId},${scope},${holder},${token},0,'0xdeadbeef',${"0x"+"c".repeat(64)}) as saved`)[0]!.saved).toBe(true);
    await sql`update plans set status='cancelled',version=version+1 where id=${f.plan.id}`;
    if (!signed) expect((await sql`select cs_ledger_persist_signed(${ack.operationId},${scope},${holder},${token},0,'0xdeadbeef',${"0x"+"d".repeat(64)}) as saved`)[0]!.saved).toBe(false);
    expect((await sql`select status from ledger_operations where id=${ack.operationId}`)[0]!.status).toBe(signed ? "submitted" : "failed");
    await sql`delete from auth.users where id=${owner}`;
    const retained = (await sql`select owner_id,plan_id,manifest from publications where receipt_id=${ack.receiptId}`)[0]!;
    expect(retained.owner_id).toBeNull(); expect(retained.plan_id).toBeNull(); expect(retained.manifest).toEqual(f.manifest);
    expect(await sql`select id from plans where id=${f.plan.id}`).toHaveLength(0);
    expect(await sql`select operation_id from ledger_signed_transactions where operation_id=${ack.operationId}`).toHaveLength(signed ? 1 : 0);
    await sql`select cs_ledger_release(${scope},${holder},${token})`;
    // A signed row deliberately remains uncertain until the worker reconciles it.
  }
});
it("requires separate exact consent for a retained result and preserves its public copy after deletion", async () => {
  const owner = randomUUID(); await sql`insert into auth.users(id) values(${owner})`;
  const f = await publicationFixture(sql, owner), ack = await f.consent(await f.preview());
  // Explicit SQL state fixture; actual chain confirmations are tested separately with the EVM/live worker.
  await sql`update ledger_operations set status='confirmed' where id=${ack.operationId}`;
  const created = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const report = reportDocumentSchema.parse({ schemaVersion: 1, id: randomUUID(), planId: f.plan.id, sequence: 1, createdAtUtc: created, kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, correctsReportId: null, reason: "cancelled_before_start", note: "private note must not escape", source: "cancellation" });
  const revision = resultRevisionSchema.parse({ schemaVersion: 1, id: randomUUID(), planId: f.plan.id, sequence: 1, reportId: report.id, createdAtUtc: created, reason: "cancelled", actualSnapshotId: null,
    result: { status: "did_not_run", executionBasis: "self_reported", energyBasis: f.plan.comparison.constraints.energyBasis, methodVersion: f.plan.comparison.methodVersion, reportId: report.id, snapshotHash: null, baselineActualMg: null, reportedActualMg: null, differenceMg: null, differencePercent: null, reasonCodes: [], deviationCodes: [] } });
  await sql`select cs_lifecycle_commit(${owner},${f.plan.id},'cancel',${randomUUID()},${dbDigest("cancel")},1,${sql.json(report)},${sql.json(revision)},${dbDigest(revision)},'','')`;
  expect(await sql`select id from published_results where result_revision_id=${revision.id}`).toHaveLength(0);
  const plan = { ...f.plan, version: 2, status: "cancelled", completion: "did_not_run", latestReport: report, latestResult: revision, reports: [report], revisions: [revision] };
  const make = (nonce: string) => buildResultManifest(plan, f.manifest, report, revision, null, { nonce, publicRevision: 1, previousResultHash: ZERO_HASH, correctionExplanation: "Public non-execution explanation." });
  const manifest = make(createProofIdentity().nonce);
  const preview = (await sql`select cs_publication_preview(${owner},${f.plan.id},2,${revision.id},${canonicalJson(manifest)},${hashResult(manifest)}) as value`)[0]!.value;
  const second = make(createProofIdentity().nonce);
  expect((await sql`select cs_publication_preview(${owner},${f.plan.id},2,${revision.id},${canonicalJson(second)},${hashResult(second)}) as value`)[0]!.value.id).toBe(preview.id);
  const key = randomUUID(), digest = dbDigest(preview.id);
  const publish = () => sql`select cs_publication_consent(${owner},${f.plan.id},${preview.id},${preview.manifest_hash},'public-proof-v1',${key},${digest},1) as value`;
  const published = (await publish())[0]!.value; expect((await publish())[0]!.value).toEqual(published);
  expect(JSON.stringify(preview.manifest)).not.toContain(report.note);
  expect(await sql`select id from published_results where result_revision_id=${revision.id}`).toHaveLength(1);
  await sql`delete from auth.users where id=${owner}`;
  const retained = (await sql`select result_revision_id,manifest from published_results where manifest_hash=${preview.manifest_hash}`)[0]!;
  expect(retained.result_revision_id).toBeNull(); expect(retained.manifest).toEqual(preview.manifest);
  expect((await sql`select status from ledger_operations where id=${published.operationId}`)[0]!.status).toBe("failed");
});
