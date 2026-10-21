import { config } from "dotenv";
import { ConfigurationError, parseWebEnvironment, parseWorkerEnvironment } from "../src/config/environment";

const args = process.argv.slice(2);
const target = args.length === 0 ? "web" : args.length === 2 && args[0] === "--target" ? args[1] : undefined;
if (target !== "web" && target !== "worker") {
  console.error("Usage: pnpm check:env [--target web|worker]");
  process.exitCode = 2;
} else {
  config({ path: target === "worker" ? [".env.worker.local"] : [".env.local", ".env"], quiet: true });
  try {
    if (target === "worker") {
      parseWorkerEnvironment(process.env);
      console.log("Worker configuration is valid. No connection or signing test was performed.");
    } else {
      const env = parseWebEnvironment(process.env);
      console.log(`Web configuration is valid. Database: ${env.database.configured ? "configured" : "unconfigured"}. AI: ${env.ai.enabled ? "enabled" : "disabled"}. Ledger: ${env.ledger.enabled ? "enabled" : "disabled"}.`);
    }
  } catch (error) {
    console.error(error instanceof ConfigurationError ? error.message : "Configuration check failed. Values are omitted.");
    process.exitCode = 1;
  }
}
