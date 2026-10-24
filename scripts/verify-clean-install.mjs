import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const options = process.argv.slice(2);
if (options.some((arg) => arg !== "--browser")) throw new Error("Use verify:clean with only the optional --browser flag.");
const temporary = await mkdtemp(join(tmpdir(), "carbonshift-foundation-"));
const excluded = new Set([".git", ".next", ".temp", ".branches", "node_modules", "test-results", "playwright-report", "coverage", ".vercel", "artifacts", "cache", ".ledger-deployment.local.json"]);
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/^(NEXT_PUBLIC_|SUPABASE_|AI_|LEDGER_|SEPOLIA_|VERCEL_)/.test(key) ||
    ["GEMINI_API_KEY", "GROQ_API_KEY", "APP_ORIGIN", "RATE_LIMIT_HMAC_SECRET", "PRIVACY_CONTACT", "CRON_SECRET", "TRUSTED_CLIENT_IP_HEADER", "NODE_ENV"].includes(key)) delete environment[key];
}
environment.NEXT_TELEMETRY_DISABLED = "1";

try {
  await cp(root, temporary, {
    recursive: true,
    filter(source) {
      const parts = relative(root, source).split(sep);
      const name = basename(source);
      return !parts.some((part) => excluded.has(part)) && name !== ".DS_Store" && name !== "next-env.d.ts" &&
        !name.endsWith(".tsbuildinfo") && !name.endsWith(".log") &&
        (!name.startsWith(".env") || [".env.example", ".env.worker.example"].includes(name));
    },
  });
  for (const args of [
    ["install", "--frozen-lockfile", "--strict-peer-dependencies"],
    ["check:env"], ["lint"], ["contracts:test"], ["typecheck"], ["test"], ["build"],
    ...(options.includes("--browser") ? [["test:e2e"]] : []),
  ]) {
    console.log(`Clean-copy check: pnpm ${args.join(" ")}`);
    const result = spawnSync("pnpm", args, { cwd: temporary, env: environment, stdio: "inherit" });
    if (result.error || result.status !== 0) throw new Error(`Clean-copy command failed: pnpm ${args.join(" ")}`);
  }
  console.log("Clean-copy foundation verification passed. No real environment files, service credentials or generated app artifacts were copied.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Clean-copy verification failed.");
  process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
