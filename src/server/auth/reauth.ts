import "server-only";
import { databaseConfiguration } from "@/server/db/clients";
import type { requireMember } from "./session";
import { ApiError } from "@/server/http/errors";
import { readProof, requestCookie, REAUTH_COOKIE, sessionBinding } from "./reauth-proof";
export async function assertRecentReauth(request: Request, member: Awaited<ReturnType<typeof requireMember>>) {
  const proof = readProof(requestCookie(request, REAUTH_COOKIE), "receipt", databaseConfiguration().hmac);
  if (!proof || proof.owner !== member.userId) throw new ApiError("REAUTH_REQUIRED", 403, "Confirm your identity in Account settings before deleting private data.");
  const session = await member.client.auth.getSession();
  const binding = session.data.session ? sessionBinding(session.data.session.access_token) : null;
  if (session.error || !binding || proof.binding !== binding) throw new ApiError("REAUTH_REQUIRED", 403, "Confirm your identity again using the same account.");
}
