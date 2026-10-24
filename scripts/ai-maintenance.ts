import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/server/db/schema";
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--apply") || args.length > 1) throw new Error("Use no arguments for a preview, or --apply for documented AI metadata retention.");
try {
  const source = { ...parse(await readFile(".env.local", "utf8")), ...process.env };
  if (!source.NEXT_PUBLIC_SUPABASE_URL || !source.SUPABASE_SECRET_KEY) throw new Error();
  const client = createClient<Database>(source.NEXT_PUBLIC_SUPABASE_URL, source.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000) }) } });
  const preview = await client.rpc("cs_ai_retention_preview"); if (preview.error) throw new Error();
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "dry-run", counts: preview.data }));
  if (args.includes("--apply")) { const result = await client.rpc("cs_ai_prune"); if (result.error) throw new Error(); console.log("Expired operational metadata pruned; shared unexpired reservations retained."); }
} catch { console.error("AI metadata maintenance unavailable. Check configuration/migration access; values omitted."); process.exitCode = 1; }
