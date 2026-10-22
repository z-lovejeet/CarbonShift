import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { createHash, randomUUID } from "node:crypto";
const url = process.env.CARBONSHIFT_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw new Error("Use the isolated integration runner");
const sql = postgres(url, { max: 12, onnotice: () => {} });
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const bucket = (key = randomUUID(), limit = 3, amount = 1, seconds = 60) => ({ key: hash(key), metric: "requests", amount, limit, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() });
async function reserve(operation: string, buckets: ReturnType<typeof bucket>[]) { return (await sql`select cs_reserve_usage(${operation},${sql.json(buckets)}) as result`)[0]!.result; }
async function task(actor = hash(randomUUID()), key = randomUUID(), fingerprint = hash("input"), buckets: ReturnType<typeof bucket>[] = []) {
  return (await sql`select cs_ai_begin_task(null,${actor},'constraints',${key},${fingerprint},${hash("policy")},22,${sql.json(buckets)}) as result`)[0]!.result;
}
async function attempt(id: string, scopes = [hash(randomUUID()), hash(randomUUID())], buckets: ReturnType<typeof bucket>[] = []) {
  return { ...(await sql`select cs_ai_reserve_attempt(${id},'gemini','gemini-3.8-flash',${randomUUID()},'constraints-v1',${sql.json(buckets)},${scopes}) as result`)[0]!.result, scopes };
}
async function finish(id: string, scopes: string[], outcome = "succeeded", usage = {}) { await sql`select cs_ai_finish_attempt(${id},${outcome},15,${sql.json(usage)},${scopes},120)`; }
afterAll(() => sql.end());
describe("M06 shared admission, task identity and bounded leases", () => {
  it("admits exactly a shared cap across concurrent independent connections", async () => {
    const b = bucket(); const results = await Promise.all(Array.from({ length: 12 }, () => reserve(randomUUID(), [b])));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(results.filter((r) => !r.allowed).every((r) => r.retryAfter >= 1 && r.retryAfter <= 60)).toBe(true);
  });
  it("rolls back all buckets when one is full", async () => {
    const a = bucket(undefined, 1), b = bucket(undefined, 1); await reserve(randomUUID(), [a]);
    expect((await reserve(randomUUID(), [a, b])).allowed).toBe(false);
    expect((await reserve(randomUUID(), [b])).allowed).toBe(true);
  });
  it("does not double charge an identical operation", async () => {
    const b = bucket(undefined, 1), operation = randomUUID();
    expect((await reserve(operation, [b])).allowed).toBe(true);
    expect((await reserve(operation, [b])).allowed).toBe(true);
    expect((await reserve(randomUUID(), [b])).allowed).toBe(false);
  });
  it("reports a daily reset later than a simultaneously blocked minute", async () => {
    const minute = bucket(undefined, 1), day = bucket(undefined, 1, 1, 3600);
    await reserve(randomUUID(), [minute, day]); const result = await reserve(randomUUID(), [minute, day]);
    expect(result.retryAfter).toBeGreaterThan(3500);
  });
  it("rejects invalid hashes, nonpositive counts and changed reservation sizes", async () => {
    await expect(reserve(randomUUID(), [{ ...bucket(), key: "raw-personal-input" }])).rejects.toThrow("INVALID_ADMISSION");
    await expect(reserve(randomUUID(), [bucket(undefined, 0)])).rejects.toThrow("INVALID_ADMISSION");
    const b = bucket(), op = randomUUID(); await reserve(op, [b]);
    await expect(reserve(op, [{ ...b, amount: 2 }])).rejects.toThrow("RESERVATION_CONFLICT");
  });
  it("deduplicates running tasks, conflicts on changed input and prevents a second active role", async () => {
    const actor = hash(randomUUID()), key = randomUUID(); const first = await task(actor, key);
    expect(first.id).toBeTruthy(); expect((await task(actor, key)).code).toBe("AI_TASK_IN_PROGRESS");
    expect((await task(actor, key, hash("changed"))).code).toBe("AI_TASK_CONFLICT");
    expect((await task(actor)).code).toBe("AI_RATE_LIMITED");
    await sql`select cs_ai_finish_task(${first.id},true)`;
    expect((await task(actor, key)).code).toBe("AI_TASK_FINISHED");
  });
  it("charges logical tasks once and retains the charge when work fails", async () => {
    const actor = hash(randomUUID()), b = bucket(undefined, 1), key = randomUUID(); const first = await task(actor, key, hash("input"), [b]);
    await task(actor, key, hash("input"), [b]); await sql`select cs_ai_finish_task(${first.id},false)`;
    expect((await task(actor, randomUUID(), hash("input"), [b])).code).toBe("AI_RATE_LIMITED");
  });
  it("records at most two dispatch intents and rejects concurrent dispatch on one task", async () => {
    const t = await task(); const a = await attempt(t.id); expect(a.attempt).toBe(1);
    expect((await attempt(t.id)).code).toBe("AI_TASK_IN_PROGRESS"); await finish(a.id, a.scopes);
    const b = await attempt(t.id); expect(b.attempt).toBe(2); await finish(b.id, b.scopes);
    expect((await attempt(t.id)).code).toBe("AI_TASK_FINISHED");
  });
  it("enforces two application slots and releases completed leases", async () => {
    const tasks = await Promise.all([task(), task(), task()]);
    const a = await attempt(tasks[0].id), b = await attempt(tasks[1].id), c = await attempt(tasks[2].id);
    expect(a.id).toBeTruthy(); expect(b.id).toBeTruthy(); expect(c.code).toBe("AI_RATE_LIMITED");
    await finish(a.id, a.scopes); const retry = await attempt(tasks[2].id); expect(retry.id).toBeTruthy();
    await finish(b.id, b.scopes); await finish(retry.id, retry.scopes);
  });
  it("skips a full provider without consuming an attempt or global capacity", async () => {
    const full = bucket(undefined, 1); await reserve(randomUUID(), [full]); const t = await task();
    expect((await attempt(t.id, undefined, [full])).code).toBe("AI_RATE_LIMITED");
    const a = await attempt(t.id); expect(a.attempt).toBe(1); await finish(a.id, a.scopes);
  });
  it("retains unknown usage on timeouts and reconciles known total tokens", async () => {
    const t = await task(); const token = { ...bucket(undefined, 5000, 2048), metric: "total_tokens" }; const scopes = [hash(randomUUID()), hash(randomUUID())];
    const a = (await sql`select cs_ai_reserve_attempt(${t.id},'groq','openai/gpt-oss-120b',${randomUUID()},'constraints-v1',${sql.json([token])},${scopes}) as result`)[0]!.result;
    await finish(a.id, scopes, "transient");
    expect((await sql`select amount::int from usage_reservations where operation_id=${a.id}`)[0]!.amount).toBe(2048);
    const b = await attempt(t.id, scopes); await finish(b.id, scopes, "succeeded", { total_tokens: 300 });
    expect((await sql`select count(*)::int as n from ai_runs where task_id=${t.id}`)[0]!.n).toBe(2);
  });
  it("honors shared 429 cooldowns and does not reset usage when a lease expires", async () => {
    const scopes = [hash(randomUUID()), hash(randomUUID())]; const t = await task(); const a = await attempt(t.id, scopes);
    await finish(a.id, scopes, "rate_limited"); const b = await attempt(t.id, scopes);
    expect(b.code).toBe("AI_RATE_LIMITED"); expect(b.retryAfter).toBeGreaterThanOrEqual(119);
  });
  it("opens after three transient failures and leases a single half-open probe", async () => {
    const scopes = [hash(randomUUID()), hash(randomUUID())];
    for (let n = 0; n < 3; n++) { const t = await task(); const a = await attempt(t.id, scopes); await finish(a.id, scopes, "transient"); }
    const t = await task(); expect((await attempt(t.id, scopes)).code).toBe("AI_RATE_LIMITED");
    await sql`update service_leases set cooldown_until=clock_timestamp()-interval '1 second' where scope=any(${scopes})`;
    const probe = await attempt(t.id, scopes); expect(probe.id).toBeTruthy();
    const other = await task(); expect((await attempt(other.id, scopes)).code).toBe("AI_RATE_LIMITED");
    await finish(probe.id, scopes); const recovered = await attempt(other.id, scopes); expect(recovered.id).toBeTruthy(); await finish(recovered.id, scopes);
  });
  it("keeps the 17-request Flash ceiling after a crashed lease and settles known usage", async () => {
    const b = bucket(undefined, 17, 1, 3600); const results = await Promise.all(Array.from({ length: 20 }, () => reserve(randomUUID(), [b])));
    expect(results.filter((r) => r.allowed)).toHaveLength(17);
    const token = { ...bucket(undefined, 5000, 2048), metric: "total_tokens" }; const t = await task(); const a = await attempt(t.id, undefined, [token]);
    await finish(a.id, a.scopes, "succeeded", { input_tokens: 100, output_tokens: 50, total_tokens: 150 });
    expect((await sql`select amount::int from usage_reservations where operation_id=${a.id}`)[0]!.amount).toBe(150);
    const crashTask = await task(), crash = await attempt(crashTask.id, undefined, [b]);
    expect(crash.code).toBe("AI_RATE_LIMITED");
    const c = await attempt(crashTask.id, undefined, [{ ...token, key: hash(randomUUID()) }]);
    await sql`update service_leases set expires_at=clock_timestamp()-interval '1 second' where holder=${c.id}`;
    expect((await sql`select amount::int from usage_reservations where operation_id=${c.id}`)[0]!.amount).toBe(2048);
    await sql`update ai_tasks set deadline=clock_timestamp()-interval '1 second' where id=${crashTask.id}`;
    expect((await attempt(crashTask.id)).code).toBe("AI_TASK_FINISHED");
  });
  for (const table of ["ai_tasks", "ai_runs", "usage_reservations", "service_leases", "ai_explanation_cache"]) {
    it(`denies member access to ${table}`, async () => {
      await expect(sql.begin(async (db) => { await db.unsafe("set local role authenticated"); return db.unsafe(`select * from ${table}`); })).rejects.toMatchObject({ code: "42501" });
      await expect(sql.begin(async (db) => { await db.unsafe("set local role anon"); return db.unsafe(`insert into ${table} default values`); })).rejects.toMatchObject({ code: "42501" });
    });
  }
  it("denies member invocation of privileged admission", async () => {
    await expect(sql.begin(async (db) => { await db.unsafe("set local role authenticated"); return db`select cs_reserve_usage(${randomUUID()},'[]')`; })).rejects.toMatchObject({ code: "42501" });
  });
  it("binds input to the frozen policy and clears only expired command identity", async () => {
    const actor = hash(randomUUID()), key = randomUUID(); const first = await task(actor, key);
    const changedPolicy = (await sql`select cs_ai_begin_task(null,${actor},'constraints',${key},${hash("input")},${hash("new-policy")},22,'[]') as result`)[0]!.result;
    expect(changedPolicy.code).toBe("AI_TASK_IN_PROGRESS");
    await sql`update ai_tasks set created_at=clock_timestamp()-interval '25 hours',deadline=clock_timestamp()-interval '24 hours' where id=${first.id}`;
    const active = bucket(undefined, 1, 1, 3600); await reserve(randomUUID(), [active]);
    await sql`select cs_ai_prune()`;
    expect((await sql`select client_key,fingerprint from ai_tasks where id=${first.id}`)[0]).toEqual({ client_key: null, fingerprint: null });
    expect((await reserve(randomUUID(), [active])).allowed).toBe(false);
    expect((await task(actor, key)).id).toBeTruthy();
  });
  it("binds a cache-hit key without spending a logical or provider allowance", async () => {
    const owner = randomUUID(), actor = hash(randomUUID()), key = randomUUID(); await sql`insert into auth.users(id) values (${owner})`;
    const bind = async (fingerprint: string) => (await sql`select cs_ai_cache_key(${owner},${actor},${key},${fingerprint},${hash("policy")}) as result`)[0]!.result;
    const first = await bind(hash("comparison-A")); expect(first.id).toBeTruthy(); expect((await bind(hash("comparison-A"))).id).toBe(first.id);
    expect((await bind(hash("comparison-B"))).code).toBe("AI_TASK_CONFLICT");
    expect((await sql`select count(*)::int as n from usage_reservations where operation_id=${first.id}`)[0]!.n).toBe(0);
    expect((await sql`select count(*)::int as n from ai_runs where task_id=${first.id}`)[0]!.n).toBe(0);
    expect((await task(actor)).id).toBeTruthy();
  });
});
