import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reserve: vi.fn() }));
vi.mock("@/server/limits/store", () => ({ reserveUsage: mocks.reserve }));
vi.mock("@/server/db/clients", () => ({ databaseConfiguration: () => ({ hmac: "authored-hmac-secret-with-32-characters", origin: "http://127.0.0.1:3000" }) }));
import { oauthIngress, mutationIngress, oauthRateResponse } from "@/server/limits/ingress";
import { browserIdentity, normalizedIp } from "@/server/limits/identity";
import { ApiError } from "@/server/http/errors";
const secret = "authored-hmac-secret-with-32-characters";
beforeEach(() => { mocks.reserve.mockReset().mockResolvedValue(undefined); vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", ""); });
describe("M06 ingress identity and separate policies", () => {
  it("signs browser identity and rejects tampering without a raw-identity bucket", () => {
    const a = browserIdentity(null, secret), b = browserIdentity(a.value, secret); expect(b.id).toBe(a.id);
    expect(browserIdentity(a.value.replace(a.id, "0".repeat(36)), secret).id).not.toBe(a.id);
    expect(a.value).toContain("HttpOnly; SameSite=Lax");
  });
  it.each([["192.0.2.8", "192.0.2.8"], ["2001:0DB8:0:0:0:0:0:1", "2001:db8::1"], ["::ffff:192.0.2.8", "192.0.2.8"], ["1.2.3.4, 5.6.7.8", null], ["unknown", null]])("normalizes only a single valid trusted IP: %s", (raw, expected) => expect(normalizedIp(raw)).toBe(expected));
  it("ignores spoofable forwarding headers without an explicit proxy contract", async () => {
    await oauthIngress(new Request("http://127.0.0.1:3000/auth/sign-in", { headers: { "x-forwarded-for": "192.0.2.1" } }), "start");
    expect(mocks.reserve.mock.calls[0]![0]).toHaveLength(1);
  });
  it("uses separate start/callback counters and no callback code or raw IP in keys", async () => {
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "x-real-ip"); const cookie = browserIdentity(null, secret).value;
    const request = new Request("http://127.0.0.1:3000/auth/callback?code=private-code-canary", { headers: { cookie, "x-real-ip": "192.0.2.1" } });
    await oauthIngress(request, "start"); await oauthIngress(request, "callback");
    const a = mocks.reserve.mock.calls[0]![0], b = mocks.reserve.mock.calls[1]![0];
    expect(a.map((x: { limit: number }) => x.limit)).toEqual([10, 60]); expect(b.map((x: { limit: number }) => x.limit)).toEqual([20, 120]);
    expect(a[0].key).not.toBe(b[0].key); expect(JSON.stringify(mocks.reserve.mock.calls)).not.toMatch(/192\.0\.2\.1|private-code-canary/);
  });
  it("keeps a shared-network counter while independent browsers have their own counters", async () => {
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "x-real-ip");
    for (let i = 0; i < 2; i++) await oauthIngress(new Request("http://127.0.0.1:3000/auth/sign-in", { headers: { cookie: browserIdentity(null, secret).value, "x-real-ip": "192.0.2.1" } }), "start");
    const a = mocks.reserve.mock.calls[0]![0], b = mocks.reserve.mock.calls[1]![0]; expect(a[0].key).not.toBe(b[0].key); expect(a[1].key).toBe(b[1].key);
  });
  it("fails closed on missing trusted proxy metadata and shares mutation admission", async () => {
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "x-real-ip"); await expect(oauthIngress(new Request("http://127.0.0.1:3000"), "start")).rejects.toMatchObject({ status: 503 });
    await mutationIngress("owner-canary"); expect(mocks.reserve.mock.calls[0]![0][0].limit).toBe(30); expect(JSON.stringify(mocks.reserve.mock.calls)).not.toContain("owner-canary");
  });
  it("offers generic accessible 429 recovery with real retry time and no automatic code exchange", async () => {
    const response = oauthRateResponse(new ApiError("RATE_LIMITED", 429, "private-upstream-canary", true, 321));
    expect(response.headers.get("retry-after")).toBe("321"); const html = await response.text(); expect(html).toContain('href="/login"'); expect(html).toContain("321 seconds"); expect(html).not.toContain("private-upstream-canary"); expect(html).not.toContain("http-equiv");
  });
});
