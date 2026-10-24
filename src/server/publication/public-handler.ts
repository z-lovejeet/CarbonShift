import "server-only";
import { randomUUID } from "node:crypto";
import { publicReadAdmission, loadPublicReceipt } from "./public-reader";
import { observePublicReceipt } from "./chain-observation";
import { publicFailure } from "@/server/http/errors";
import { exportVersionedBundle } from "@/domain/proof/versions";
export async function publicReceiptHandler(request: Request, receiptId: string, kind: "summary" | "bundle" | "observations") {
  const requestId = randomUUID();
  try {
    const cookie = await publicReadAdmission(request), receipt = await loadPublicReceipt(receiptId), headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "Set-Cookie": cookie };
    if (kind === "bundle") return new Response(exportVersionedBundle(receipt.bundle), { headers: { ...headers, "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="carbonshift-proof.json"' } });
    const data = kind === "observations" ? { context: await observePublicReceipt(receipt) } : receipt;
    return Response.json({ data, requestId }, { headers });
  } catch (e) { return publicFailure(e, requestId); }
}
