import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { createHash, randomUUID } from "node:crypto";
import { createComparison } from "@/domain/scheduling";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { constraints, snapshot } from "../fixtures/domain";

const url = process.env.CARBONSHIFT_TEST_DATABASE_URL;
if (!url || !new URL(url).hostname.match(/^(127\.0\.0\.1|localhost)$/)) throw new Error("Use the isolated integration runner.");
const sql = postgres(url, { max: 12, onnotice: () => {} });
const A = randomUUID(), B = randomUUID();
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
async function proposal(owner = A, changes: { expired?: boolean; stale?: boolean } = {}) {
  const clock = Date.parse(now()) - (changes.expired ? 600_000 : changes.stale ? 200_000 : 0);
  const iso = (value: number) => new Date(value).toISOString().replace(".000Z", "Z");
  const first = Math.ceil((clock + 3_600_000) / 1_800_000) * 1_800_000;
  const snap = snapshot();
  snap.retrievedAtUtc = iso(clock - (changes.stale ? 1_740_000 : 0));
  snap.intervals = snap.intervals.map((item, i) => ({ ...item, fromUtc: iso(first + i * 1_800_000), toUtc: iso(first + (i + 1) * 1_800_000) }));
  const record = createGridSnapshotRecord(snap);
  const comparison = createComparison({ constraints: { ...constraints(), earliestStartUtc: iso(first), deadlineUtc: iso(first + 14_400_000), baselineStartUtc: iso(first), confirmedAtUtc: iso(clock) }, snapshot: snap, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, iso(clock));
  const id = randomUUID();
  // Trusted seed of historical expired proposals is intentionally distinct from the product RPC.
  if (changes.expired || changes.stale) {
    await sql`insert into grid_snapshots(id,payload_text,digest,retrieved_at) values (${record.id},${JSON.stringify(record.snapshot)},${record.hash},${record.snapshot.retrievedAtUtc})`;
    await sql`insert into comparisons(id,owner_id,snapshot_id,snapshot_hash,payload,expires_at,created_at) values (${id},${owner},${record.id},${record.hash},${sql.json(comparison)},${comparison.expiresAtUtc},${comparison.createdAtUtc})`;
  } else {
    await sql`select cs_create_comparison(${owner},${id},${record.id},${JSON.stringify(record.snapshot)},${record.hash},${sql.json(comparison)})`;
  }
  return { id, record, comparison };
}
function digest(id: string, version = 1) { return createHash("sha256").update(JSON.stringify({ comparisonId: id, comparisonVersion: version })).digest("hex"); }
async function accept(id: string, key = randomUUID(), owner = A, version = 1) {
  const rows = await sql`select (cs_accept_plan(${owner},${id},${version},${key},${digest(id,version)})).*`;
  return rows[0]!;
}
async function asMember<T>(user: string, query: (transaction: postgres.TransactionSql) => Promise<T>) {
  return sql.begin(async (transaction) => {
    await transaction`select set_config('request.jwt.claim.sub',${user},true)`;
    await transaction.unsafe("set local role authenticated");
    return query(transaction);
  });
}
beforeAll(async () => { await sql`insert into auth.users(id) values (${A}),(${B})`; });
afterAll(async () => { await sql.end(); });

describe("T02/T07 private planning database", () => {
  it("creates private owner profiles without a public directory", async () => {
    expect(await asMember(A, (db) => db`select user_id from profiles`)).toEqual([{ user_id: A }]);
  });
  it("freezes the reviewed payload and snapshot and returns one acceptance", async () => {
    const proposalA = await proposal();
    const key = randomUUID();
    const first = await accept(proposalA.id, key);
    const second = await accept(proposalA.id, key);
    expect(second.id).toBe(first.id);
    expect(first.accepted_payload).toEqual(proposalA.comparison);
    expect((await asMember(A, (db) => db`select id from plans where id=${first.id}`))).toHaveLength(1);
    expect((await asMember(B, (db) => db`select id from plans where id=${first.id}`))).toHaveLength(0);
    expect((await asMember(B, (db) => db`select id from grid_snapshots where id=${proposalA.record.id}`))).toHaveLength(0);
  });
  for (const table of ["profiles", "grid_snapshots", "comparisons", "plans", "mutation_keys", "usage_buckets"]) {
    for (const action of ["insert", "update", "delete"]) {
      it(`denies direct member ${action.toUpperCase()} on ${table}`, async () => {
        const statement = action === "insert" ? `insert into public.${table} default values` : action === "update" ? `update public.${table} set ${table === "profiles" ? "created_at=created_at" : table === "usage_buckets" ? "count=count" : table === "mutation_keys" ? "scope=scope" : "id=id"}` : `delete from public.${table}`;
        await expect(asMember(B, (db) => db.unsafe(statement))).rejects.toMatchObject({ code: "42501" });
      });
    }
  }
  it("denies anonymous reads and privileged function calls", async () => {
    await expect(sql.begin(async (db) => { await db.unsafe("set local role anon"); return db`select * from plans`; })).rejects.toMatchObject({ code: "42501" });
    await expect(asMember(B, (db) => db`select cs_accept_plan(${A},${randomUUID()},1,'test-key-123',${"a".repeat(64)})`)).rejects.toMatchObject({ code: "42501" });
    await expect(asMember(B, (db) => db`select cs_comparison_quota(${"a".repeat(64)})`)).rejects.toMatchObject({ code: "42501" });
  });
  it("checks ownership on the elevated acceptance path", async () => {
    const item = await proposal();
    await expect(accept(item.id, randomUUID(), B)).rejects.toMatchObject({ message: "NOT_FOUND" });
  });
  it("rejects version and changed-body idempotency conflicts", async () => {
    const item = await proposal(), other = await proposal();
    await expect(accept(item.id, randomUUID(), A, 2)).rejects.toMatchObject({ message: "VERSION_CONFLICT" });
    const key = randomUUID();
    await accept(item.id, key);
    await expect(accept(other.id, key)).rejects.toMatchObject({ message: "IDEMPOTENCY_CONFLICT" });
  });
  it("serializes concurrent same-key and different-key accepts to one plan", async () => {
    const item = await proposal(), key = randomUUID();
    const rows = await Promise.all(Array.from({ length: 10 }, (_, i) => accept(item.id, i < 5 ? key : randomUUID())));
    expect(new Set(rows.map((row) => row.id)).size).toBe(1);
    expect(await sql`select id from plans where comparison_id=${item.id}`).toHaveLength(1);
  });
  it("rejects expired proposals without leaving a plan or key", async () => {
    const item = await proposal(A, { expired: true });
    await expect(accept(item.id)).rejects.toMatchObject({ message: "COMPARISON_EXPIRED" });
    expect(await sql`select id from plans where comparison_id=${item.id}`).toHaveLength(0);
  });
  it("rejects changed immutable records even for service writes", async () => {
    const item = await proposal(), plan = await accept(item.id);
    await expect(sql`update comparisons set version=1 where id=${item.id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" });
    await expect(sql`update grid_snapshots set payload_text=payload_text where id=${item.record.id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" });
    await expect(sql`update plans set accepted_payload=${sql.json({ tampered: true })} where id=${plan.id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" });
  });
  it("rejects snapshot digest mismatches and cross-owner foreign keys", async () => {
    const item = await proposal();
    await expect(sql`insert into grid_snapshots(id,payload_text,digest,retrieved_at) values (${randomUUID()},${JSON.stringify(item.record.snapshot)},${"0x"+"f".repeat(64)},${item.record.snapshot.retrievedAtUtc})`).rejects.toMatchObject({ code: "23514" });
    await expect(sql`insert into plans(owner_id,comparison_id,accepted_payload) values (${B},${item.id},${sql.json(item.comparison)})`).rejects.toMatchObject({ code: "23503" });
  });
  it("enforces a shared atomic ten-per-minute comparison quota", async () => {
    const subject = createHash("sha256").update(randomUUID()).digest("hex");
    const rows = await Promise.all(Array.from({ length: 20 }, () => sql`select cs_comparison_quota(${subject}) as allowed`));
    expect(rows.filter((row) => row[0]!.allowed)).toHaveLength(10);
  });
  it("rolls back the plan if the idempotency write fails", async () => {
    const item = await proposal();
    await sql.unsafe(`create function public.test_reject_mutation() returns trigger language plpgsql as $$ begin raise exception 'TEST_WRITE_FAILURE'; end $$;
      create trigger test_reject_mutation before insert on mutation_keys for each row execute function public.test_reject_mutation();`);
    try {
      await expect(accept(item.id)).rejects.toMatchObject({ message: "TEST_WRITE_FAILURE" });
      expect(await sql`select id from plans where comparison_id=${item.id}`).toHaveLength(0);
    } finally { await sql.unsafe("drop trigger test_reject_mutation on mutation_keys; drop function public.test_reject_mutation()"); }
  });
  it("rolls back a newly inserted snapshot when comparison ownership fails", async () => {
    const before = await sql`select count(*) as count from grid_snapshots`;
    await expect(proposal(randomUUID())).rejects.toMatchObject({ code: "23503" });
    expect(await sql`select count(*) as count from grid_snapshots`).toEqual(before);
  });
  it("denies direct member invocation of the comparison writer", async () => {
    await expect(asMember(B, (db) => db`select cs_create_comparison(${A},${randomUUID()},${randomUUID()},'{}',${"0x"+"a".repeat(64)},'{}'::jsonb)`)).rejects.toMatchObject({ code: "42501" });
  });
  it("rejects a server insert whose accepted payload differs from its comparison", async () => {
    const item = await proposal();
    await expect(sql`insert into plans(owner_id,comparison_id,accepted_payload) values (${A},${item.id},${sql.json({ ...item.comparison, differenceMg: 1 })})`).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects an unexpired comparison whose forecast is now stale", async () => {
    const item = await proposal(A, { stale: true });
    await expect(accept(item.id)).rejects.toMatchObject({ message: "COMPARISON_EXPIRED" });
    expect(await sql`select id from plans where comparison_id=${item.id}`).toHaveLength(0);
  });
});
