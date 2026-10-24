import { randomUUID, createHash } from "node:crypto";
import type postgres from "postgres";
import { createComparison } from "@/domain/scheduling";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { planSchema } from "@/contracts/planning";
import { buildPlanManifest } from "@/server/proof/builders";
import { createProofIdentity } from "@/server/proof/identity";
import { canonicalJson, hashPlan } from "@/domain/proof";
import { constraints, snapshot } from "./domain";
export const dbDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const TEST_CONTRACT = "0x" + "a1".repeat(20);
export async function publicationFixture(sql: postgres.Sql, owner: string) {
  const clock = Math.floor(Date.now() / 1000) * 1000, first = Math.ceil((clock + 7200000) / 1800000) * 1800000;
  const iso = (v: number) => new Date(v).toISOString().replace(".000Z", "Z");
  const s = snapshot(); s.retrievedAtUtc = iso(clock);
  s.intervals = s.intervals.map((row, i) => ({ ...row, fromUtc: iso(first + i * 1800000), toUtc: iso(first + (i + 1) * 1800000) }));
  const record = createGridSnapshotRecord(s), comparisonId = randomUUID();
  const comparison = createComparison({ constraints: { ...constraints(), earliestStartUtc: iso(first), deadlineUtc: iso(first + 14400000), baselineStartUtc: iso(first), confirmedAtUtc: iso(clock) }, snapshot: s, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, iso(clock));
  await sql`select cs_create_comparison(${owner},${comparisonId},${record.id},${JSON.stringify(record.snapshot)},${record.hash},${sql.json(comparison)})`;
  const [row] = await sql`select (cs_accept_plan(${owner},${comparisonId},1,${randomUUID()},${dbDigest(comparisonId)})).*`;
  const plan = planSchema.parse({ schemaVersion: 1, id: row!.id, version: 1, comparisonId, mode: "live", status: "accepted", acceptedAtUtc: iso(new Date(row!.accepted_at).getTime()), comparison, forecastSnapshot: s, completion: "not_reported", publication: "private", latestReport: null, latestResult: null, reports: [], revisions: [] });
  const fresh = createProofIdentity();
  const [identity] = await sql`select cs_publication_identity(${owner},${plan.id},${fresh.receiptId},${fresh.nonce},${TEST_CONTRACT}) as value`;
  const manifest = buildPlanManifest(plan, identity!.value);
  const preview = async () => (await sql`select cs_publication_preview(${owner},${plan.id},${plan.version},null,${canonicalJson(manifest)},${hashPlan(manifest)}) as value`)[0]!.value;
  const consent = async (draft: { id: string; manifest_hash: string }, key = randomUUID(), digest = dbDigest(draft.id), actor = owner) =>
    (await sql`select cs_publication_consent(${actor},${plan.id},${draft.id},${draft.manifest_hash},'public-proof-v1',${key},${digest},null) as value`)[0]!.value;
  return { plan, manifest, preview, consent };
}
