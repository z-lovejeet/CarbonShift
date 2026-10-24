import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, mkdir, stat } from "node:fs/promises";
import { parse } from "dotenv";
import { encodeDeployData, getContractAddress, keccak256, parseTransaction, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { parseDeploymentEnvironment } from "../src/config/environment";
import { createSepoliaClient, verifyReceiptContract, MAX_FEE_PER_GAS } from "../src/worker/chain";
import { SHIFT_RECEIPT_ABI_V1 as abi } from "../src/generated/shift-receipt-v1";
import metadata from "../src/generated/shift-receipt-v1.build.json";

const journalPath = ".ledger-deployment.local.json";
let stage = "load configuration";
const sha256 = (hex: string) => `0x${createHash("sha256").update(Buffer.from(hex.slice(2), "hex")).digest("hex")}`;
async function updateLocal(path: string, updates: Record<string, string>) {
  const original = await readFile(path, "utf8"); let next = original;
  for (const [name, value] of Object.entries(updates)) {
    const line = `${name}=${JSON.stringify(value)}`, pattern = new RegExp(`^${name}=.*$`, "m");
    next = pattern.test(next) ? next.replace(pattern, () => line) : `${next.trimEnd()}\n${line}\n`;
  }
  if (await readFile(path, "utf8") !== original) throw new Error("Concurrent environment edit; retry configuration update.");
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, next, { mode: 0o600, flag: "wx" }); await rename(temporary, path);
}
try {
  if (process.argv.slice(2).some((arg) => arg !== "--broadcast")) throw new Error();
  const source = parse(await readFile(".env.worker.local", "utf8")), env = parseDeploymentEnvironment(source);
  const account = privateKeyToAccount(env.privateKey as Hex), client = createSepoliaClient(env.rpcUrl);
  if (await client.getChainId() !== 11155111) throw new Error();
  stage = "verify compiled artifact"; const artifact = JSON.parse(await readFile("contracts/artifacts/contracts/ShiftReceipt.sol/ShiftReceipt.json", "utf8"));
  if (sha256(artifact.bytecode) !== metadata.creationBytecodeSha256 || sha256(artifact.deployedBytecode) !== metadata.runtimeBytecodeSha256) throw new Error();
  if (!process.argv.includes("--broadcast")) {
    console.log("Sepolia deployment preparation passed. Use --broadcast for the authorized real testnet deployment; no transaction signed or sent.");
  } else {
    let journal: { chainId: number; signer: string; contractAddress: Hex; raw: Hex; hash: Hex; nonce: number; creationBytecodeSha256: string } | null = null;
    try {
      await stat(journalPath); journal = JSON.parse(await readFile(journalPath, "utf8"));
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    }
    if (journal === null) {
      stage = "read deployment nonce"; const nonce = await client.getTransactionCount({ address: account.address, blockTag: "pending" });
      const data = encodeDeployData({ abi, bytecode: artifact.bytecode as Hex, args: [account.address] });
      stage = "estimate deployment gas and fees"; const gas = (await client.estimateGas({ account, data })) * 120n / 100n, fees = await client.estimateFeesPerGas();
      stage = "check gas, fee and balance bounds";
      if (gas > 6000000n || fees.maxFeePerGas > MAX_FEE_PER_GAS || await client.getBalance({ address: account.address }) < gas * fees.maxFeePerGas) throw new Error();
      stage = "sign and persist deployment"; const raw = await account.signTransaction({ type: "eip1559", chainId: 11155111, data, gas, nonce, value: 0n, ...fees });
      journal = { chainId: 11155111, signer: account.address.toLowerCase(), contractAddress: getContractAddress({ from: account.address, nonce: BigInt(nonce) }), raw, hash: keccak256(raw), nonce, creationBytecodeSha256: metadata.creationBytecodeSha256 };
      // The dedicated deployment also persists exact signed bytes before broadcast.
      await writeFile(journalPath, JSON.stringify(journal), { flag: "wx", mode: 0o600 });
    }
    stage = "validate durable deployment"; const tx = parseTransaction(journal.raw);
    if (journal.chainId !== 11155111 || journal.signer !== account.address.toLowerCase() || journal.creationBytecodeSha256 !== metadata.creationBytecodeSha256 || keccak256(journal.raw) !== journal.hash || tx.chainId !== 11155111 || tx.nonce !== journal.nonce || tx.to || tx.data !== encodeDeployData({ abi, bytecode: artifact.bytecode as Hex, args: [account.address] }) || journal.contractAddress.toLowerCase() !== getContractAddress({ from: account.address, nonce: BigInt(journal.nonce) }).toLowerCase()) throw new Error();
    stage = "broadcast or reconcile deployment"; let mined = await client.getTransactionReceipt({ hash: journal.hash }).catch(() => null);
    if (!mined) {
      try { await client.sendRawTransaction({ serializedTransaction: journal.raw }); } catch { /* Reconcile the persisted hash; an accepted broadcast may have lost its acknowledgment. */ }
      console.log(`Deployment transaction: ${journal.hash}. Waiting for inclusion and two further blocks.`);
      mined = await client.waitForTransactionReceipt({ hash: journal.hash, confirmations: 3, timeout: 240000, pollingInterval: 5000 });
    }
    stage = "verify deployed receipt and bytecode"; if (mined.status !== "success" || mined.contractAddress?.toLowerCase() !== journal.contractAddress.toLowerCase()) throw new Error();
    if (await client.getBlockNumber({ cacheTime: 0 }) < mined.blockNumber + 2n) mined = await client.waitForTransactionReceipt({ hash: journal.hash, confirmations: 3, timeout: 240000, pollingInterval: 5000 });
    const block = await client.getBlock({ blockNumber: mined.blockNumber });
    if (block.hash !== mined.blockHash) throw new Error();
    await verifyReceiptContract(client, journal.contractAddress);
    if ((await client.readContract({ address: journal.contractAddress, abi, functionName: "owner" })).toLowerCase() !== account.address.toLowerCase()) throw new Error();
    const blockNumber = Number(mined.blockNumber); if (!Number.isSafeInteger(blockNumber)) throw new Error();
    await mkdir("research/phase-9", { recursive: true });
    await writeFile("research/phase-9/sepolia-deployment.json", JSON.stringify({ checkedAtUtc: new Date().toISOString(), chainId: 11155111, contractAddress: journal.contractAddress.toLowerCase(), issuer: account.address.toLowerCase(), transactionHash: journal.hash, deploymentBlock: blockNumber, blockHash: mined.blockHash, confirmationPolicy: "two blocks after inclusion", gasUsed: mined.gasUsed.toString(), effectiveGasPrice: mined.effectiveGasPrice.toString(), build: metadata, runtimeBytecodeMatched: true, ownerMatched: true }, null, 2) + "\n");
    const updates = { LEDGER_ENABLED: "true", LEDGER_CHAIN_ID: "11155111", LEDGER_CONTRACT_ADDRESS: journal.contractAddress.toLowerCase(), LEDGER_DEPLOYMENT_BLOCK: String(blockNumber) };
    stage = "configure verified local deployment"; await updateLocal(".env.worker.local", updates);
    await updateLocal(".env.local", { ...updates, SEPOLIA_RPC_URL: env.rpcUrl });
    console.log(`Sepolia contract verified: ${journal.contractAddress.toLowerCase()}, deployment block ${blockNumber}. Local public metadata configured; signing key remains worker-only.`);
  }
} catch { console.error(`Deployment/configuration could not be confirmed at: ${stage}. Check the durable local journal and configuration; never discard it to retry with a fresh nonce. Credential/provider details omitted.`); process.exitCode = 1; }
