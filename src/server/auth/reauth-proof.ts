import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
const proofSchema = z.strictObject({ purpose: z.enum(["intent", "receipt"]), owner: z.uuid(), binding: z.string().min(1).max(128), issued: z.number().int(), expires: z.number().int() });
export const REAUTH_SECONDS = 600;
export const REAUTH_COOKIE = "cs-reauth", REAUTH_INTENT_COOKIE = "cs-reauth-intent";
export function issueProof(purpose: "intent" | "receipt", owner: string, binding: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify(proofSchema.parse({ purpose, owner, binding, issued: nowSeconds, expires: nowSeconds + REAUTH_SECONDS }))).toString("base64url");
  return payload + "." + createHmac("sha256", secret).update(`CarbonShift:reauth:v1:${payload}`).digest("base64url");
}
export function readProof(value: string | undefined, purpose: "intent" | "receipt", secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!value || value.length > 1024) return null;
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra !== undefined) return null;
    const actual = Buffer.from(signature, "base64url"), expected = createHmac("sha256", secret).update(`CarbonShift:reauth:v1:${payload}`).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const proof = proofSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return proof.purpose === purpose && proof.issued <= nowSeconds && proof.expires > nowSeconds && proof.expires - proof.issued === REAUTH_SECONDS ? proof : null;
  } catch { return null; }
}
export function requestCookie(request: Request, name: string) { return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="))?.slice(name.length + 1); }
export function proofCookie(name: string, value: string, origin: string, clear = false) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : REAUTH_SECONDS}${origin.startsWith("https:") ? "; Secure" : ""}`;
}
export function sessionBinding(accessToken: string): string | null {
  try { return z.uuid().parse(JSON.parse(Buffer.from(accessToken.split(".")[1]!, "base64url").toString()).session_id); } catch { return null; }
}
export const newReauthNonce = () => randomUUID();
