import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID, createHash } from "node:crypto";
import { calculateSchedule } from "@/server/schedules/calculation";
import { snapshot } from "../fixtures/domain";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import type { ScheduleComparison } from "@/contracts/schedules";
const url = process.env.CARBONSHIFT_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw new Error("Use the isolated integration runner.");
const sql = postgres(url, { max: 8, onnotice: () => {} }), owner = randomUUID(), other = randomUUID();
const iso = (n: number) => new Date(n).toISOString().replace(/\.\d{3}Z$/, "Z");
beforeAll(async () => { await sql`insert into auth.users(id) values(${owner}),(${other})`; });
afterAll(async () => { await sql.end(); });
async function fixture() {
  const now = Date.now(), start = Math.ceil((now + 3600000) / 1800000) * 1800000;
  const s = snapshot([300, 100]); s.retrievedAtUtc = iso(now); s.intervals = s.intervals.map((r, i) => ({ ...r, fromUtc: iso(start + i * 1800000), toUtc: iso(start + (i + 1) * 1800000) }));
  const record = createGridSnapshotRecord(s);
  const comparison = await calculateSchedule({ input: { schemaVersion: 2, kind: "tasks", geography: "GB_NATIONAL", timezone: "Europe/London", dayDate: null, tasks: ["tv", "fan"].map((id) => ({ activity: { schemaVersion: 2, id, category: id === "tv" ? "television" : "fan", name: id, durationMinutes: 15, quantity: 1, energy: { kind: "average_power", powerMw: 100000, origin: "user_estimate", confirmed: true } }, baselineStartUtc: iso(start), windows: [{ startUtc: iso(start), endUtc: iso(start + 3600000) }], blocks: [], fixedStartUtc: null, resourceIds: [], predecessorIds: [], requiresAttention: false })) }, constraintsConfirmed: true }, { getForecast: async () => record, getActual: async () => record }, () => iso(Date.now()));
  await sql`select cs_create_schedule_comparison(${owner},${sql.json(comparison)})`; return comparison;
}
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
async function accept(c: ScheduleComparison, key = randomUUID(), user = owner, choice = 0) { return (await sql`select cs_accept_schedule(${user},${c.id},${choice},${key},${digest(c.id + ':' + choice)}) as id`)[0]!.id as string; }
async function member(user: string, action: (db: postgres.TransactionSql) => Promise<unknown>) { return sql.begin(async (db) => { await db`select set_config('request.jwt.claim.sub',${user},true)`; await db.unsafe("set local role authenticated"); return action(db); }); }
it("atomically accepts every task and keeps retry/choice identity", async () => { const c = await fixture(), key = randomUUID(), ids = await Promise.all([accept(c, key), accept(c, key), accept(c)]); expect(new Set(ids).size).toBe(1); expect(await sql`select task_id from schedule_tasks where schedule_id=${ids[0]!}`).toHaveLength(2); await expect(accept(c, key, owner, 1)).rejects.toMatchObject({ message: "IDEMPOTENCY_CONFLICT" }); expect((await sql`select accepted_payload from schedules where id=${ids[0]!}`)[0]!.accepted_payload).toEqual(c); });
it("denies foreign reads, direct writes and privileged calls", async () => { const c = await fixture(), id = await accept(c); expect(await member(other, (db) => db`select id from schedules where id=${id}`)).toEqual([]); expect(await member(owner, (db) => db`select id from schedules where id=${id}`)).toHaveLength(1); await expect(accept(c, randomUUID(), other)).rejects.toMatchObject({ message: "NOT_FOUND" }); await expect(member(owner, (db) => db`select cs_accept_schedule(${owner},${c.id},0,${randomUUID()},${digest('x')})`)).rejects.toMatchObject({ code: "42501" }); await expect(member(owner, (db) => db`insert into schedules default values`)).rejects.toMatchObject({ code: "42501" }); });
it("rejects expired comparisons and preserves immutable accepted data", async () => { const c = await fixture(); const stale = structuredClone(c); stale.id = randomUUID(); stale.createdAtUtc = iso(Date.now()-600000); stale.expiresAtUtc = iso(Date.now()-300000); await expect(sql`select cs_create_schedule_comparison(${owner},${sql.json(stale)})`).rejects.toMatchObject({ message: "COMPARISON_EXPIRED" }); const id = await accept(c); await expect(sql`update schedules set option_index=1 where id=${id}`).rejects.toMatchObject({ message: "IMMUTABLE_RECORD" }); });
it("rolls back parent insert when an immutable child identity conflicts", async () => { const c = await fixture(), malformed = structuredClone(c); malformed.id = randomUUID(); malformed.input.tasks[1]!.activity.id = malformed.input.tasks[0]!.activity.id; await sql`select cs_create_schedule_comparison(${owner},${sql.json(malformed)})`; await expect(accept(malformed)).rejects.toMatchObject({ code: "23505" }); expect(await sql`select id from schedules where comparison_id=${malformed.id}`).toHaveLength(0); });
