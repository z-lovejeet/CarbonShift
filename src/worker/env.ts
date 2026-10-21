import { env } from "node:process";
import { parseWorkerEnvironment } from "../config/environment";

// Node-only imports plus the import-boundary check keep the signer out of UI code.
export function getWorkerEnvironment() {
  return parseWorkerEnvironment(env);
}
