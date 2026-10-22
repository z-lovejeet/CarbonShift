import "server-only";
import { databaseConfiguration } from "@/server/db/clients";
import { ApiError } from "@/server/http/errors";
import { requestBudget, subject } from "./budgets";
import { browserIdentity, normalizedIp } from "./identity";
import { reserveUsage } from "./store";

export async function mutationIngress(userId: string) {
  const config = databaseConfiguration();
  await reserveUsage([requestBudget(`mutation:${subject(config.hmac, "mutation", userId)}`, 30, new Date().toISOString(), 60)]);
}
export async function oauthIngress(request: Request, kind: "start" | "callback"): Promise<string> {
  const config = databaseConfiguration();
  const browser = browserIdentity(request.headers.get("cookie"), config.hmac);
  const now = new Date().toISOString(), browserHash = subject(config.hmac, `oauth-${kind}-browser`, browser.id);
  const budgets = [requestBudget(`oauth-${kind}:${browserHash}`, kind === "start" ? 10 : 20, now, 600)];
  // Only configured hosting contracts may make a forwarded header authoritative.
  const header = process.env.TRUSTED_CLIENT_IP_HEADER?.trim();
  if (header) {
    if (!["x-vercel-forwarded-for", "cf-connecting-ip", "x-real-ip"].includes(header)) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Sign-in services are unavailable.");
    const ip = normalizedIp(request.headers.get(header));
    if (!ip) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Sign-in services are unavailable.");
    budgets.push(requestBudget(`oauth-${kind}-ip:${subject(config.hmac, `oauth-${kind}-ip`, ip)}`, kind === "start" ? 60 : 120, now, 600));
  }
  await reserveUsage(budgets);
  return browser.value + (config.origin.startsWith("https:") ? "; Secure" : "");
}
/** Native form/callback recovery never retries a code or redirects in a loop. */
export function oauthRateResponse(error: ApiError): Response {
  const retry = Math.max(1, Math.min(172800, Math.ceil(error.retryAfterSeconds ?? 60)));
  return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pause before signing in — CarbonShift</title><main style="max-width:36rem;margin:12vh auto;padding:1.5rem;font:1.1rem/1.6 system-ui"><h1>Pause before signing in</h1><p>Several sign-in requests arrived recently. Please wait ${retry} seconds, then return to sign-in to start again.</p><p>Your existing account has not changed.</p><a href="/login">Return to sign-in</a></main></html>`, {
    status: 429, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Retry-After": String(retry), "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" },
  });
}
