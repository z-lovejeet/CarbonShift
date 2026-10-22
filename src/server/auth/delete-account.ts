import { randomUUID } from "node:crypto";
import { accountDeleteRequestSchema } from "@/contracts/lifecycle";
import { idempotencyKeySchema } from "@/contracts/planning";
import { parseDomain } from "@/domain/errors";
import { assertSameOrigin, readJson } from "@/server/http/request";
import { ApiError, publicFailure } from "@/server/http/errors";
import { proofCookie, REAUTH_COOKIE, REAUTH_INTENT_COOKIE } from "./reauth-proof";

type Dependencies = { origin: () => string; authenticate: () => Promise<{ userId: string; reauthenticate: (request: Request) => Promise<void>; remove: () => Promise<void>; signOut: () => Promise<void> }>; ingress: (owner: string) => Promise<void> };
export function createDeleteAccountHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    const requestId = randomUUID();
    try {
      assertSameOrigin(request, dependencies.origin());
      const member = await dependencies.authenticate(); await dependencies.ingress(member.userId);
      parseDomain(accountDeleteRequestSchema, await readJson(request));
      if (!idempotencyKeySchema.safeParse(request.headers.get("idempotency-key")).success) throw new ApiError("INVALID_IDEMPOTENCY_KEY", 422, "Use a valid retry key.");
      await member.reauthenticate(request);
      await member.remove();
      // Identity removal is authoritative even if the now-invalid session cannot be revoked again.
      try { await member.signOut(); } catch { /* Account has already been removed. */ }
      const response = Response.json({ data: { deleted: true }, requestId }, { headers: { "Cache-Control": "no-store" } });
      for (const name of [REAUTH_COOKIE, REAUTH_INTENT_COOKIE]) response.headers.append("Set-Cookie", proofCookie(name, "", dependencies.origin(), true));
      return response;
    } catch (error) { return publicFailure(error, requestId); }
  };
}
