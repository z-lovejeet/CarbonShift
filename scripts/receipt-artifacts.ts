import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const artifactPath = "contracts/artifacts/contracts/ShiftReceipt.sol/ShiftReceipt.json";
const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
if (artifact.contractName !== "ShiftReceipt" || artifact.sourceName !== "contracts/ShiftReceipt.sol" || !/^0x[0-9a-f]+$/.test(artifact.bytecode)) throw new Error("Unexpected compiled receipt artifact.");
const build = JSON.parse(await readFile(`contracts/artifacts/build-info/${artifact.buildInfoId}.json`, "utf8"));
const sha256 = (value: string | Uint8Array) => `0x${createHash("sha256").update(value).digest("hex")}`;
const source = await readFile(artifact.sourceName);
if (sha256(build.input.sources[artifact.inputSourceName]?.content ?? "") !== sha256(source)) throw new Error("Compiled source is stale; compile before generating artifacts.");
const metadata = {
  artifactVersion: 1, contractName: artifact.contractName, sourceName: artifact.sourceName,
  compiler: build.solcLongVersion, evmVersion: build.input.settings.evmVersion, optimizer: build.input.settings.optimizer,
  openzeppelinVersion: JSON.parse(await readFile("node_modules/@openzeppelin/contracts/package.json", "utf8")).version,
  sourceSha256: sha256(source), abiSha256: sha256(JSON.stringify(artifact.abi)),
  creationBytecodeSha256: sha256(Buffer.from(artifact.bytecode.slice(2), "hex")), runtimeBytecodeSha256: sha256(Buffer.from(artifact.deployedBytecode.slice(2), "hex")),
};
const files = new Map([
  ["src/generated/shift-receipt-v1.ts", `// Generated from the pinned compiler artifact by pnpm proof:artifacts. Do not edit.\nexport const SHIFT_RECEIPT_ABI_V1 = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`],
  ["src/generated/shift-receipt-v1.build.json", `${JSON.stringify(metadata, null, 2)}\n`],
]);
const mode = process.argv[2];
if (!["--write", "--check"].includes(mode ?? "")) throw new Error("Choose --write or --check.");
for (const [path, expected] of files) {
  if (mode === "--write") await writeFile(path, expected);
  else if (await readFile(path, "utf8") !== expected) throw new Error(`Stale generated artifact: ${path}. Run pnpm proof:artifacts and review the change.`);
}
console.log(mode === "--write" ? "Generated receipt v1 ABI and build fingerprints." : "Receipt v1 ABI and build fingerprints match the compiled artifact.");
