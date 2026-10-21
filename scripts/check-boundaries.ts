import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { inspectDomainPurity, inspectImportBoundaries } from "./lib/import-boundaries";

async function collect(directory: string): Promise<[string, string][]> {
  const files: [string, string][] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = join(directory, entry.name);
    if (name === "src/test") continue;
    if (entry.isDirectory()) files.push(...await collect(name));
    else if (/\.tsx?$/.test(name)) files.push([name, await readFile(name, "utf8")]);
  }
  return files;
}

const files = new Map(await collect("src"));
const errors = [...inspectImportBoundaries(files), ...inspectDomainPurity(files)];
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log("Client import/environment boundaries and domain purity passed for current source files.");
