import { issueProof, readProof, requestCookie, proofCookie, REAUTH_COOKIE, REAUTH_INTENT_COOKIE, sessionBinding } from "@/server/auth/reauth-proof";
import { createUserClient, databaseConfiguration } from "@/server/db/clients";
import { allowedDestination } from "@/server/auth/policy";
import { oauthIngress, oauthRateResponse } from "@/server/limits/ingress";
import { ApiError } from "@/server/http/errors";

export async function GET(request: Request) {
  let browserCookie: string;
  try { browserCookie = await oauthIngress(request, "callback"); }
  catch (error) { return error instanceof ApiError && error.status === 429 ? oauthRateResponse(error) : new Response("Sign-in services are unavailable. Return to CarbonShift and try again.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
  const response = await completeCallback(request);
  response.headers.append("Set-Cookie", browserCookie);
  return response;
}
async function completeCallback(request: Request) {
  let origin: string;
  try { origin = databaseConfiguration().origin; }
  catch { return new Response("Sign-in services are unavailable. Return to CarbonShift and try again.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
  const url = new URL(request.url);
  const failure = () => new Response(null, { status: 303, headers: { Location: `${origin}/login?error=sign_in_failed`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const code = url.searchParams.get("code");
  if (url.searchParams.has("error") || !code || code.length > 4096 || url.searchParams.getAll("code").length !== 1) return failure();
  try {
    const client = await createUserClient();
    const exchange = await client.auth.exchangeCodeForSession(code);
    if (exchange.error) return failure();
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user) return failure();
    if (requestCookie(request, REAUTH_INTENT_COOKIE)) {
      const config = databaseConfiguration();
      const intent = readProof(requestCookie(request, REAUTH_INTENT_COOKIE), "intent", config.hmac);
      const binding = exchange.data.session ? sessionBinding(exchange.data.session.access_token) : null;
      if (!intent || intent.owner !== verified.data.user.id || !binding || !["google", "github"].includes(verified.data.user.app_metadata.provider ?? "")) { await client.auth.signOut({ scope: "local" }); return failure(); }
      const response = new Response(null, { status: 303, headers: { Location: origin + "/app/settings?reauth=confirmed", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
      response.headers.append("Set-Cookie", proofCookie(REAUTH_COOKIE, issueProof("receipt", intent.owner, binding, config.hmac), origin));
      response.headers.append("Set-Cookie", proofCookie(REAUTH_INTENT_COOKIE, "", origin, true));
      return response;
    }
    return new Response(null, { status: 303, headers: { Location: origin + allowedDestination(url.searchParams.get("next")), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return failure(); }
}
