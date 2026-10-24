import type postgres from "postgres";
import { calculateSchedule } from "@/server/schedules/calculation";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { snapshot } from "./domain";
import { scheduleDocumentSchema } from "@/contracts/schedules";
import { randomUUID, createHash } from "node:crypto";
export const fixtureDigest = (text: string) => createHash("sha256").update(text).digest("hex");
export async function scheduleDatabaseFixture(sql: postgres.Sql, owner: string) {
  const iso = (n: number) => new Date(n).toISOString().replace(/\.\d{3}Z$/, "Z"), clock = Date.now(), first = Math.ceil((clock + 7200000) / 1800000) * 1800000, s = snapshot([300, 100]);
  s.retrievedAtUtc = iso(clock); s.intervals = s.intervals.map((r, i) => ({ ...r, fromUtc: iso(first + i * 1800000), toUtc: iso(first + (i + 1) * 1800000) })); const record = createGridSnapshotRecord(s);
  const comparison = await calculateSchedule({ constraintsConfirmed: true, input: { schemaVersion: 2, kind: "tasks", geography: "GB_NATIONAL", timezone: "Europe/London", dayDate: null, tasks: [0, 1].map((i) => ({ activity: { schemaVersion: 2, id: `private-${i}`, category: "television", name: `Private routine ${i}`, durationMinutes: 15, quantity: 1, energy: { kind: "average_power", powerMw: 100000, origin: "user_estimate", confirmed: true } }, baselineStartUtc: iso(first + i * 900000), windows: [{ startUtc: iso(first), endUtc: iso(first + 3600000) }], blocks: [], fixedStartUtc: null, resourceIds: [], predecessorIds: [], requiresAttention: false })) } }, { getForecast: async () => record, getActual: async () => record }, () => iso(Date.now()));
  await sql`select cs_create_schedule_comparison(${owner},${sql.json(comparison)})`;
  const id = (await sql`select cs_accept_schedule(${owner},${comparison.id},0,${randomUUID()},${fixtureDigest(comparison.id)}) as id`)[0]!.id;
  const row = (await sql`select accepted_at from schedules where id=${id}`)[0]!;
  return scheduleDocumentSchema.parse({ schemaVersion: 2, id, comparison, optionIndex: 0, acceptedAtUtc: iso(new Date(row.accepted_at).getTime()) });
}
