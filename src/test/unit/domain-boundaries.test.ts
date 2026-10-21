import { expect, it } from "vitest";
import { inspectDomainPurity } from "../../../scripts/lib/import-boundaries";

it("allows pure domain imports and limits Temporal to the time module", () => {
  expect(inspectDomainPurity(new Map([
    ["src/domain/time.ts", "import { Temporal } from '@js-temporal/polyfill'; import { z } from 'zod'; const date = new Date('2026-01-01T00:00:00Z');"],
    ["src/domain/schemas/index.ts", "import { METHOD } from '../method'; export { E } from '@/domain/errors';"],
  ]))).toEqual([]);
});
it.each(["@/server/grid", "../fixtures/demo/example.json", "react", "node:fs", "groq-sdk", "@js-temporal/polyfill"])("rejects domain dependency %s", (specifier) => {
  expect(inspectDomainPurity(new Map([["src/domain/scheduling.ts", `import { x } from '${specifier}';`]]))).toHaveLength(1);
});
it.each(["fetch('url')", "process.env.KEY", "window.location", "Date.now()", "new Date()", "Date()", "Math.random()", "Temporal.Now.instant()", "import('./time')", "require('./time')", "globalThis.fetch('url')"])("rejects ambient domain operation %s", (operation) => {
  expect(inspectDomainPurity(new Map([["src/domain/time.ts", operation]]))).not.toEqual([]);
});
