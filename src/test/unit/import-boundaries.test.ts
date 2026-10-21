import { expect, it } from "vitest";
import { inspectImportBoundaries } from "../../../scripts/lib/import-boundaries";

it("allows server components to import server-only configuration", () => {
  expect(inspectImportBoundaries(new Map([["src/app/page.tsx", "import { env } from '@/server/env';"]]))).toEqual([]);
});

it("detects a client import through an otherwise harmless barrel", () => {
  const files = new Map([
    ["src/components/client.tsx", "'use client'; import { env } from './shared';"],
    ["src/components/shared.ts", "export { env } from '../server/env';"],
    ["src/server/env.ts", "import 'server-only'; export const env = {};"],
  ]);
  expect(inspectImportBoundaries(files)).toEqual([expect.stringContaining("Client imports backend configuration")]);
});

it("detects signer access and private environment reads", () => {
  const files = new Map([
    ["src/components/client.tsx", "'use client'; import { env } from '@/worker/env'; const x=process.env.GROQ_API_KEY;"],
    ["src/worker/env.ts", "import { env } from 'node:process';"],
  ]);
  expect(inspectImportBoundaries(files)).toHaveLength(2);
});

it("rejects model SDKs and nonliteral dynamic imports in client graphs", () => {
  const files = new Map([["src/components/client.tsx", "'use client'; import { Groq } from 'groq-sdk'; import(moduleName);"]]);
  expect(inspectImportBoundaries(files)).toHaveLength(2);
});

it("permits public Supabase configuration and erased type imports", () => {
  const files = new Map([
    ["src/components/client.tsx", "'use client'; import type { X } from '@/server/env'; const u=process.env.NEXT_PUBLIC_SUPABASE_URL;"],
    ["src/server/env.ts", "import 'server-only';"],
  ]);
  expect(inspectImportBoundaries(files)).toEqual([]);
});

it("rejects copying the whole environment and permits cycles without infinite recursion", () => {
  const files = new Map([
    ["src/components/client.tsx", "'use client'; import './cycle'; const x={...process.env};"],
    ["src/components/cycle.ts", "import './client';"],
  ]);
  expect(inspectImportBoundaries(files)).toHaveLength(1);
});
