import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import postgres from "postgres";
import { URL } from "node:url";

// Local runs create a disposable cluster; CI may supply only its fresh loopback fixture.
// Neither branch resets a database or reads the application database environment.
const directory = await mkdtemp(join(tmpdir(), "carbonshift-db-"));
const configured = spawnSync("pg_config", ["--bindir"], { encoding: "utf8" });
const binary = process.env.CARBONSHIFT_PG_BINDIR || configured.stdout?.trim();
let started = false;
function run(file, args, options = {}) {
  const result = spawnSync(file, args, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0) throw new Error(`${file} failed: ${result.stderr || result.error?.message || result.stdout}`);
  return result;
}
try {
  let url = process.env.CARBONSHIFT_CI_DATABASE_URL;
  if (url) {
    const candidate = new URL(url);
    if (process.env.CI !== "true" || candidate.protocol !== "postgres:" || candidate.hostname !== "127.0.0.1" || candidate.pathname !== "/carbonshift_test" || candidate.username !== "postgres" || candidate.search || candidate.hash) {
      throw new Error("CI database must be the dedicated loopback carbonshift_test fixture.");
    }
  } else {
    if (!binary) throw new Error("PostgreSQL server tools are required; set CARBONSHIFT_PG_BINDIR to their bin directory.");
    const server = createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    const socket = join(directory, "socket");
    await mkdir(socket);
    run(join(binary, "initdb"), ["-D", join(directory, "data"), "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--no-locale"]);
    run(join(binary, "pg_ctl"), ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"), "-o", `-p ${port} -h 127.0.0.1 -k ${socket}`, "-w", "start"]);
    started = true;
    url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const existing = await sql`select count(*)::int as count from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth')`;
    const functions = await sql`select count(*)::int as count from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth')`;
    if (existing[0].count !== 0 || functions[0].count !== 0) throw new Error("Integration fixture is not empty; refusing to alter it.");
    await sql.unsafe(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key, created_at timestamptz not null default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;`);
    for (const name of (await readdir("supabase/migrations")).filter((value) => value.endsWith(".sql")).sort()) {
      await sql.unsafe(await readFile(join("supabase/migrations", name), "utf8"));
    }
  } finally { await sql.end(); }
  console.log("Migrations applied to a fresh isolated PostgreSQL fixture.");
  const result = spawnSync("pnpm", ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"], {
    stdio: "inherit", env: { ...process.env, CARBONSHIFT_TEST_DATABASE_URL: url },
  });
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Integration setup failed.");
  process.exitCode = 1;
} finally {
  if (started) spawnSync(join(binary, "pg_ctl"), ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
  await rm(directory, { recursive: true, force: true });
}
