import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/server/db/schema";

const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => arg !== "--apply")) throw new Error("Use no arguments to preview retention, or --apply to prune eligible private/operational records.");
try {
  const source = { ...parse(await readFile(".env.local", "utf8")), ...process.env };
  if (!source.NEXT_PUBLIC_SUPABASE_URL || !source.SUPABASE_SECRET_KEY) throw new Error();
  const client = createClient<Database>(source.NEXT_PUBLIC_SUPABASE_URL, source.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) }) } });
  const result = await client.rpc("cs_retention", { p_apply: args.includes("--apply") });
  if (result.error) throw new Error();
  console.log(JSON.stringify(result.data));
} catch { console.error("Retention unavailable; check configuration/migration. Credentials and provider details omitted."); process.exitCode = 1; }
