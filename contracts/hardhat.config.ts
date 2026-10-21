import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "hardhat/config";
import nodeTests from "@nomicfoundation/hardhat-node-test-runner";
import viem from "@nomicfoundation/hardhat-viem";

export default defineConfig({
  plugins: [nodeTests, viem],
  paths: {
    sources: fileURLToPath(new URL("./", import.meta.url)),
    tests: { nodejs: fileURLToPath(new URL("./test", import.meta.url)) },
    artifacts: fileURLToPath(new URL("./artifacts", import.meta.url)),
    cache: fileURLToPath(new URL("./cache", import.meta.url)),
  },
  solidity: {
    version: "0.8.37",
    path: createRequire(import.meta.url).resolve("solc/soljson.js"),
    preferWasm: true,
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: { hardhat: { type: "edr-simulated", chainType: "l1", chainId: 31337 } },
});
