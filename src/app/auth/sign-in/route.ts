import { requireMember } from "@/server/auth/session";
import { issueProof, newReauthNonce, proofCookie, REAUTH_INTENT_COOKIE } from "@/server/auth/reauth-proof";
import { randomUUID } from "node:crypto";
import { createUserClient, databaseConfiguration } from "@/server/db/clients";
import { providerSchema } from "@/server/auth/policy";
import { assertSameOrigin, readBody } from "@/server/http/request";
import { ApiError, publicFailure } from "@/server/http/errors";
import { oauthIngress, oauthRateResponse } from "@/server/limits/ingress";

export async function POST(request: Request) {
  let browserCookie: string | undefined;
  let intentCookie: string | undefined;
  const headers = () => ({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...(browserCookie ? { "Set-Cookie": browserCookie } : {}) });
  try {
    const config = databaseConfiguration();
    assertSameOrigin(request, config.origin);
    browserCookie = await oauthIngress(request, "start");
    if (Number(request.headers.get("content-length")) > 1024) throw new ApiError("BODY_TOO_LARGE", 413, "This request is too large.");
    // Only the two small server-authored forms are accepted; never read a return URL from a client.
    if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") throw new ApiError("INVALID_CONTENT_TYPE", 415, "Use the sign-in form.");
    const raw = await readBody(request, 1024);
    if (Buffer.byteLength(raw) > 1024) throw new ApiError("BODY_TOO_LARGE", 413, "This request is too large.");
    const form = new URLSearchParams(raw);
    const provider = providerSchema.safeParse(form.get("provider"));
    if (!provider.success || [...form.keys()].some((key) => key !== "provider" && key !== "intent") || form.getAll("provider").length !== 1 || form.getAll("intent").length > 1 || (form.has("intent") && form.get("intent") !== "reauth")) throw new ApiError("INVALID_PROVIDER", 422, "Choose Google or GitHub to continue.");
    const redirectTo = `${config.origin}/auth/callback`;
    if (form.get("intent") === "reauth") {
      const member = await requireMember();
      const nonce = newReauthNonce();
      intentCookie = proofCookie(REAUTH_INTENT_COOKIE, issueProof("intent", member.userId, nonce, config.hmac), config.origin);

    }
    const client = await createUserClient();
    const { data, error } = await client.auth.signInWithOAuth({ provider: provider.data, options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) return new Response(null, { status: 303, headers: { Location: `${config.origin}/login?error=provider_unavailable`, ...headers() } });
    const destination = new URL(data.url);
    if (destination.origin !== new URL(config.url).origin || destination.pathname !== "/auth/v1/authorize") throw new ApiError("AUTH_UNAVAILABLE", 503, "Sign-in services are unavailable.", true);
    const response = new Response(null, { status: 303, headers: { Location: destination.toString(), ...headers() } });
    response.headers.append("Set-Cookie", intentCookie ?? proofCookie(REAUTH_INTENT_COOKIE, "", config.origin, true));
    return response;
  } catch (error) {
    const response = error instanceof ApiError && error.status === 429 ? oauthRateResponse(error) : publicFailure(error, randomUUID());
    if (browserCookie) response.headers.append("Set-Cookie", browserCookie); return response;
  }
}
