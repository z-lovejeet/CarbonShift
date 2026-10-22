/* global fetch, URL, AbortSignal */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

// Explicit live development check. Not part of normal tests/CI; sends no emails.
config({ path: ".env.local", quiet: true });
const origin = process.env.APP_ORIGIN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!origin || new URL(origin).hostname !== "127.0.0.1" || url !== "https://vfpcmbmaymzzhkkowhiv.supabase.co") throw new Error("This check is restricted to the selected isolated development project and loopback app.");
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!publicKey || !secret) throw new Error("Required local configuration is absent; values omitted.");
const transport = (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(15000) });
const admin = createClient(url, secret, { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } });
const created = [];
function ensure(error, step) { if (error) throw new Error(`${step} failed (${error.code ?? error.status ?? "unavailable"}); details omitted.`); }
async function member() {
  const email = `carbonshift-m04-${randomUUID()}@example.invalid`;
  const user = await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { fixture: "m04-integration" } });
  ensure(user.error, "Test user creation");
  assert.ok(user.data.user);
  created.push(user.data.user.id);
  // Admin-generated links are test provisioning only, never a product login route or email send.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  ensure(link.error, "Test session provisioning");
  const client = createClient(url, publicKey, { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  ensure(verified.error, "Test session verification");
  assert.ok(verified.data.session);
  const jar = new Map();
  const ssr = createServerClient(url, publicKey, { global: { fetch: transport }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll(values) { values.forEach(({ name, value }) => jar.set(name, value)); } } });
  const session = await ssr.auth.setSession(verified.data.session);
  ensure(session.error, "SSR fixture session");
  return { id: user.data.user.id, client, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") };
}
async function call(member, path, body, key) {
  const response = await fetch(origin + "/api/v1" + path, { method: body === undefined ? "GET" : "POST", headers: {
    cookie: member.cookie, origin, ...(body === undefined ? {} : { "content-type": "application/json" }), ...(key ? { "idempotency-key": key } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const data = await response.json();
  return { status: response.status, data: data.data, error: data.error };
}
try {
  const a = await member(), b = await member();
  console.log("Two isolated Auth sessions provisioned; no email provider setting changed and no emails sent.");
  const first = Math.ceil((Date.now() + 3_600_000) / 1_800_000) * 1_800_000;
  const iso = (value) => new Date(value).toISOString().replace(".000Z", "Z");
  const input = { geography: "GB_NATIONAL", timezone: "Europe/London", earliestStartUtc: iso(first), deadlineUtc: iso(first + 21_600_000), durationMinutes: 60, energyWh: 1000,
    energyBasis: "user_estimate", blockedIntervals: [], baseline: { kind: "earliest_feasible" }, constraintsConfirmed: true };
  const compared = await call(a, "/comparisons", input);
  assert.equal(compared.status, 200, `Live comparison failed: ${compared.error?.code ?? "unknown"}`);
  const body = { comparisonId: compared.data.id, comparisonVersion: compared.data.version }, key = randomUUID();
  const accepted = await call(a, "/plans", body, key);
  assert.equal(accepted.status, 200, `Live acceptance failed: ${accepted.error?.code ?? "unknown"}`);
  assert.equal(accepted.data.comparison.forecastSnapshotHash, compared.data.forecastSnapshotHash);
  const repeated = await call(a, "/plans", body, key);
  assert.equal(repeated.data.id, accepted.data.id);
  const raced = await Promise.all([call(a, "/plans", body, randomUUID()), call(a, "/plans", body, randomUUID())]);
  raced.forEach((result) => { assert.equal(result.status, 200); assert.equal(result.data.id, accepted.data.id); });
  assert.equal((await call(a, "/plans/" + accepted.data.id)).status, 200);
  assert.equal((await call(b, "/plans/" + accepted.data.id)).status, 404);
  assert.equal((await call(b, "/plans", body, randomUUID())).status, 404);
  const conflict = await call(a, "/plans", { ...body, comparisonVersion: 2 }, key);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");
  const firstPage = await call(a, "/plans?limit=1");
  assert.equal(firstPage.status, 200);
  assert.equal(firstPage.data.items[0].id, accepted.data.id);
  const secondComparison = await call(a, "/comparisons", input);
  assert.equal(secondComparison.status, 200);
  assert.equal((await call(a, "/plans", { comparisonId: secondComparison.data.id, comparisonVersion: 1 }, randomUUID())).status, 200);
  const page = await call(a, "/plans?limit=1");
  assert.ok(page.data.nextCursor);
  const next = await call(a, "/plans?limit=1&cursor=" + encodeURIComponent(page.data.nextCursor));
  assert.equal(next.status, 200);
  assert.notEqual(next.data.items[0].id, page.data.items[0].id);
  const direct = await b.client.from("plans").select("id").eq("id", accepted.data.id);
  ensure(direct.error, "Cross-user SELECT"); assert.equal(direct.data.length, 0);
  const mutation = await b.client.from("plans").update({ status: "cancelled" }).eq("id", accepted.data.id);
  assert.ok(mutation.error);
  const rpc = await b.client.rpc("cs_accept_plan", { p_owner: a.id, p_comparison: body.comparisonId, p_version: 1, p_key: randomUUID(), p_request_digest: "a".repeat(64) });
  assert.ok(rpc.error);
  console.log(JSON.stringify({ result: "passed", basis: "real grid + hosted Supabase + local HTTP API + seeded Auth sessions", checks: ["comparison", "immutable acceptance", "retry", "concurrent acceptance", "owner detail", "cross-user API/RLS denial", "idempotency conflict", "cursor pagination", "privileged RPC denial"], planId: accepted.data.id, snapshotId: compared.data.forecastSnapshotId, snapshotHash: compared.data.forecastSnapshotHash }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Account integration check failed; details omitted.");
  process.exitCode = 1;
} finally {
  for (const id of created.reverse()) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) { console.error("Fixture-user cleanup failed; only this run's created test IDs were targeted."); process.exitCode = 1; }
  }
  console.log("Fixture-user cleanup finished; real OAuth users were not targeted.");
}
