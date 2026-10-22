import { writeFile } from "node:fs/promises";
import { disabledAiPolicy } from "../src/config/ai-policy";
const path = process.argv[2];
if (!path || !path.endsWith(".json") || path.startsWith(".env")) throw new Error("Choose a new JSON file path. Existing files are never overwritten.");
await writeFile(path, JSON.stringify(disabledAiPolicy, null, 2) + "\n", { flag: "wx", mode: 0o600 });
console.log("Disabled policy template created. No keys, model qualification or account limits were invented. AI remains disabled.");
