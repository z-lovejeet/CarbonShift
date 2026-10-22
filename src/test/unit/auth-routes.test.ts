import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), exchange: vi.fn(), user: vi.fn(), signOut: vi.fn(), ingress: vi.fn() }));
vi.mock("@/server/limits/ingress", () => ({ oauthIngress: mocks.ingress, oauthRateResponse: () => new Response(null, { status: 429 }) }));
vi.mock("@/server/db/clients", () => ({ databaseConfiguration: () => ({ origin: "http://127.0.0.1:3000", url: "https://project.supabase.co", hmac: "isolated-reauthentication-secret-value" }), createUserClient: async () => ({ auth: { signInWithOAuth: mocks.signIn, exchangeCodeForSession: mocks.exchange, getUser: mocks.user, signOut: mocks.signOut } }) }));
import { POST as signIn } from "@/app/auth/sign-in/route";
import { GET as callback } from "@/app/auth/callback/route";
import { POST as signOut } from "@/app/auth/sign-out/route";
import { allowedDestination } from "@/server/auth/policy";
import { ApiError } from "@/server/http/errors";
const origin = "http://127.0.0.1:3000";
const form = (body = "provider=google", requestOrigin = origin) => new Request(origin + "/auth/sign-in", { method: "POST", headers: { origin: requestOrigin, "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }, body });
beforeEach(() => {
  mocks.ingress.mockReset().mockResolvedValue("authored-browser-cookie");
  mocks.signIn.mockResolvedValue({ data: { url: "https://project.supabase.co/auth/v1/authorize?provider=google" }, error: null });
  mocks.exchange.mockResolvedValue({ data: {}, error: null });
  mocks.user.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
describe("T02 OAuth handlers", () => {
  it("throttles starts before redirect and callbacks before exchanging any code", async () => {
    mocks.ingress.mockRejectedValue(new ApiError("RATE_LIMITED", 429, "Wait", true, 100));
    expect((await signIn(form())).status).toBe(429); expect(mocks.signIn).not.toHaveBeenCalled();
    expect((await callback(new Request(origin + "/auth/callback?code=private-code"))).status).toBe(429); expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.ingress.mock.calls.map((c) => c[1])).toEqual(["start", "callback"]);
    expect((await signOut(form(""))).status).toBe(303); expect(mocks.signOut).toHaveBeenCalled();
  });
  it.each(["google", "github"])("starts %s with PKCE through Supabase", async (provider) => {
    const response = await signIn(form(`provider=${provider}`));
    expect(response.status).toBe(303);
    expect(mocks.signIn).toHaveBeenCalledWith({ provider, options: { redirectTo: origin + "/auth/callback", skipBrowserRedirect: true } });
  });
  it.each(["provider=email", "provider=google&provider=github", "provider=google&next=https://evil.test"])("rejects invalid provider/form %s", async (body) => {
    expect((await signIn(form(body))).status).toBe(422);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("rejects cross-origin sign-in and sign-out", async () => {
    expect((await signIn(form("provider=google", "https://evil.test"))).status).toBe(403);
    expect((await signOut(form("", "https://evil.test"))).status).toBe(403);
  });
  it("does not redirect to an unexpected provider URL or leak its message", async () => {
    mocks.signIn.mockResolvedValue({ data: { url: "https://evil.test" }, error: null });
    const response = await signIn(form());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("evil.test");
  });
  it.each(["?error=access_denied&error_description=private-canary", "", "?code=a&code=b"])("handles cancellation/malformed callback safely: %s", async (query) => {
    const response = await callback(new Request(origin + "/auth/callback" + query));
    expect(response.headers.get("location")).toBe(origin + "/login?error=sign_in_failed");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("exchanges the code, validates identity and rejects an external return destination", async () => {
    const response = await callback(new Request(origin + "/auth/callback?code=one-time-code&next=https://evil.test"));
    expect(mocks.exchange).toHaveBeenCalledWith("one-time-code");
    expect(mocks.user).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(origin + "/login");
  });
  it("does not accept a failed or replayed code", async () => {
    mocks.exchange.mockResolvedValue({ error: { message: "secret-canary" } });
    const response = await callback(new Request(origin + "/auth/callback?code=used-code"));
    expect(response.headers.get("location")).toContain("sign_in_failed");
    expect(await response.text()).not.toContain("secret-canary");
  });
  it("signs out locally and returns to login", async () => {
    expect((await signOut(form(""))).headers.get("location")).toBe(origin + "/login");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it.each(["//evil.test", "/\\evil.test", "/app?next=https://evil.test", "/app/../auth/sign-in", "/app\n"])("refuses unsafe destinations %s", (destination) => expect(allowedDestination(destination)).toBe("/login"));
});
it("returns a successful first sign-in to the implemented plans dashboard", async () => {
  const response = await callback(new Request(origin + "/auth/callback?code=one-time-code"));
  expect(response.status).toBe(303);expect(response.headers.get("location")).toBe(origin + "/app");
});

const reauthOwner = "eb18a200-4098-49d4-ac88-8a3061affc50", reauthSession = "3bdd42f5-ae4d-42ec-9133-6b78d6aa3dc4";
const reauthSecret = "isolated-reauthentication-secret-value";
it("T02 starts recent confirmation only for a validated existing member and keeps the callback allowlist", async () => {
  mocks.user.mockResolvedValue({ data: { user: { id: reauthOwner } }, error: null });
  const response = await signIn(form("provider=google&intent=reauth"));
  expect(response.status).toBe(303); expect(mocks.user).toHaveBeenCalledOnce();
  expect(response.headers.get("set-cookie")).toContain("cs-reauth-intent=");
  expect(mocks.signIn.mock.calls[0]![0].options.redirectTo).toBe(origin + "/auth/callback");
});
it.each(["google", "github"])("T02 mints a receipt only after a fresh same-account %s exchange", async (provider) => {
  const { issueProof } = await import("@/server/auth/reauth-proof");
  const proof = issueProof("intent", reauthOwner, "authored-nonce", reauthSecret);
  const jwt = "x." + Buffer.from(JSON.stringify({ session_id: reauthSession })).toString("base64url") + ".x";
  mocks.exchange.mockResolvedValue({ data: { session: { access_token: jwt } }, error: null });
  mocks.user.mockResolvedValue({ data: { user: { id: reauthOwner, app_metadata: { provider } } }, error: null });
  const response = await callback(new Request(origin + "/auth/callback?code=fresh-code", { headers: { cookie: "cs-reauth-intent=" + proof } }));
  expect(response.headers.get("location")).toBe(origin + "/app/settings?reauth=confirmed");
  expect(response.headers.get("set-cookie")).toContain("cs-reauth=");
});
it("T02 rejects an account switch and a query parameter alone cannot authorize deletion", async () => {
  const { issueProof } = await import("@/server/auth/reauth-proof");
  mocks.exchange.mockResolvedValue({ data: { session: { access_token: "x." + Buffer.from(JSON.stringify({ session_id: reauthSession })).toString("base64url") + ".x" } }, error: null });
  mocks.user.mockResolvedValue({ data: { user: { id: reauthSession, app_metadata: { provider: "github" } } }, error: null });
  const response = await callback(new Request(origin + "/auth/callback?code=fresh-code", { headers: { cookie: "cs-reauth-intent=" + issueProof("intent", reauthOwner, "nonce", reauthSecret) } }));
  expect(response.headers.get("location")).toContain("sign_in_failed"); expect(response.headers.get("set-cookie")).not.toContain("cs-reauth="); expect(mocks.signOut).toHaveBeenCalled();
  const ordinary = await callback(new Request(origin + "/auth/callback?code=fresh-code&reauth=forged"));
  expect(ordinary.headers.get("set-cookie")).not.toContain("cs-reauth=");
});
