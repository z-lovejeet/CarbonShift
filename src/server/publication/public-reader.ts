import "server-only";
import { z } from "zod";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { ApiError } from "@/server/http/errors";
import { databaseError } from "@/server/plans/repository";
import { nonzeroHashSchema } from "@/domain/proof/schemas";
import { anyBundleSchema, anyPlanSchema, anyResultSchema, versionedPlanHash, versionedResultHash, exportVersionedBundle } from "@/domain/proof/versions";
import { METHOD_DESCRIPTOR } from "@/domain/proof/method-descriptor";
import { METHOD_V2_DESCRIPTOR } from "@/domain/proof/v2/canonical";
import { operationView } from "./repository";
import { reserveUsage } from "@/server/limits/store";
import { requestBudget, subject } from "@/server/limits/budgets";
import { browserIdentity } from "@/server/limits/identity";
export async function publicReadAdmission(request: Request) {
  const config = databaseConfiguration(), browser = browserIdentity(request.headers.get("cookie"), config.hmac), now = new Date().toISOString();
  await reserveUsage([requestBudget("public-receipts-global", 300, now, 60), requestBudget(`public-receipts:${subject(config.hmac, "public-browser", browser.id)}`, 30, now, 60)]);
  return browser.value;
}
export async function loadPublicReceipt(receiptId: string) {
  if (!nonzeroHashSchema.safeParse(receiptId).success) throw new ApiError("NOT_FOUND", 404, "This receipt was not found.");
  const client = createServiceClient(), row = await client.from("publications").select("id,manifest,manifest_hash").eq("receipt_id", receiptId).maybeSingle(); databaseError(row.error);
  if (!row.data) throw new ApiError("NOT_FOUND", 404, "This receipt was not found.");
  const pub = row.data, [results, operations] = await Promise.all([client.from("published_results").select("id,manifest,manifest_hash").eq("publication_id", pub.id).order("public_sequence"), client.from("ledger_operations").select("*").eq("publication_id", pub.id)]); databaseError(results.error); databaseError(operations.error);
  const plan = anyPlanSchema.parse(pub.manifest), parsedResults = (results.data ?? []).map((r) => anyResultSchema.parse(r.manifest));
  if (versionedPlanHash(plan) !== pub.manifest_hash || (results.data ?? []).some((r, i) => versionedResultHash(parsedResults[i]) !== r.manifest_hash)) throw new ApiError("INVALID_PROOF", 503, "The hosted receipt could not be validated.");
  const planOperation = operations.data?.find((o) => o.kind === "plan"); if (!planOperation) throw new ApiError("SERVICE_UNAVAILABLE", 503, "The publication status is unavailable.");
  const resultOperations = (results.data ?? []).map((r) => { const op = operations.data?.find((o) => o.result_id === r.id); if (!op) throw new ApiError("SERVICE_UNAVAILABLE", 503, "The result status is unavailable."); return operationView(op); });
  const planOp = operationView(planOperation);
  const bundle = anyBundleSchema.parse({ schemaVersion: plan.schemaVersion, plan, results: parsedResults, method: plan.schemaVersion === 1 ? METHOD_DESCRIPTOR : METHOD_V2_DESCRIPTOR,
    chainReferences: planOp.status === "confirmed" && planOp.transactionHash && resultOperations.every((o) => o.status === "confirmed" && o.transactionHash) ? { chainId: plan.chainId, contractAddress: plan.contractAddress, planTransactionHash: planOp.transactionHash, resultTransactionHashes: resultOperations.map((o) => o.transactionHash) } : null });
  try { exportVersionedBundle(bundle); } catch { throw new ApiError("EXPORT_TOO_LARGE", 413, "This complete receipt exceeds its export-size limit. It has not been silently truncated."); }
  return { bundle, operation: planOp, resultOperations };
}
export const publicReceiptResponseSchema = z.object({ bundle: anyBundleSchema });
