import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/server/db/database.types";
const args = process.argv.slice(2);
if (args.some((argument) => argument !== "--apply") || args.length > 1) throw new Error("Use no arguments to preview expired private retry metadata, or --apply to prune it.");
try {
  const source = { ...parse(await readFile(".env.local", "utf8")), ...process.env };
  if (!source.NEXT_PUBLIC_SUPABASE_URL || !source.SUPABASE_SECRET_KEY) throw new Error();
  const client = createClient<Database>(source.NEXT_PUBLIC_SUPABASE_URL, source.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000) }) } });
  const preview = await client.from("lifecycle_mutations").select("*", { count: "exact", head: true }).lte("expires_at", new Date().toISOString());
  if (preview.error) throw new Error();
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "dry-run", expiredAcknowledgements: preview.count }));
  if (args.includes("--apply")) {
    const result = await client.rpc("cs_prune_lifecycle_mutations"); if (result.error) throw new Error();
    console.log(JSON.stringify({ removedAcknowledgements: result.data }));
  }
} catch { console.error("Private retry maintenance unavailable. Check configuration and migrations; values omitted."); process.exitCode = 1; }
