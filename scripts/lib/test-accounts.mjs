/* global fetch, URL, AbortSignal */
import { Buffer } from "node:buffer";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";

// Explicit development checks only. Does not change providers or send messages/emails.
export function testAccounts() {
  config({ path: ".env.local", quiet: true });
  const origin = process.env.APP_ORIGIN, url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!origin || new URL(origin).hostname !== "127.0.0.1" || url !== "https://vfpcmbmaymzzhkkowhiv.supabase.co") throw new Error("Use only the selected development project and loopback app.");
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, secret = process.env.SUPABASE_SECRET_KEY;
  if (!publicKey || !secret) throw new Error("Required local account configuration is absent; values omitted.");
  const transport = (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(15_000) });
  const admin = createClient(url, secret, { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } });
  const created = [];
  const ensure = (error, step) => { if (error) throw new Error(`${step} failed; provider details omitted.`); };
  return {
    origin,
    async member() {
      const email = `carbonshift-m05-${randomUUID()}@example.invalid`;
      const user = await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { fixture: "m05-browser" } });
      ensure(user.error, "Fixture identity creation");if (!user.data.user) throw new Error("Fixture identity absent.");created.push(user.data.user.id);
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email });ensure(link.error, "Fixture session preparation");
      const client = createClient(url, publicKey, { global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false } });
      const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });ensure(verified.error, "Fixture session verification");
      if (!verified.data.session) throw new Error("Fixture session absent.");
      const jar = new Map();
      const ssr = createServerClient(url, publicKey, { global: { fetch: transport }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll(values) { values.forEach(({ name, value }) => jar.set(name, value)); } } });
      const session = await ssr.auth.setSession(verified.data.session);ensure(session.error, "Fixture cookie provisioning");
      return { id: user.data.user.id, sessionId: JSON.parse(Buffer.from(verified.data.session.access_token.split(".")[1], "base64url").toString()).session_id, cookies: [...jar].map(([name, value]) => ({ name, value, url: origin, httpOnly: true, secure: false, sameSite: "Lax" })) };
    },
    async cleanup() { for (const id of created.reverse()) { const result = await admin.auth.admin.deleteUser(id);if (result.error?.code !== "user_not_found") ensure(result.error, "Fixture-user cleanup"); } },
  };
}
