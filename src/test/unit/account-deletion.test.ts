import { beforeEach, expect, it, vi } from "vitest";
import { createDeleteAccountHandler } from "@/server/auth/delete-account";
import { ApiError } from "@/server/http/errors";
const reauthenticate = vi.fn(), remove = vi.fn(), signOut = vi.fn(), ingress = vi.fn();
const origin = "http://127.0.0.1:3000";
const handle = createDeleteAccountHandler({ origin: () => origin, ingress, authenticate: async () => ({ userId: "owner", reauthenticate, remove, signOut }) });
const request = (body: unknown = { acknowledgeDeletion: true }, from = origin) => new Request(origin + "/api/v1/account/delete", { method: "POST", headers: { Origin: from, "Content-Type": "application/json", "Idempotency-Key": "account-delete-key" }, body: JSON.stringify(body) });
beforeEach(() => { for (const mock of [reauthenticate, remove, signOut, ingress]) mock.mockReset().mockResolvedValue(undefined); });
it("T02/T09 requires actual recent reauthentication before account removal", async () => {
  reauthenticate.mockRejectedValue(new ApiError("REAUTH_REQUIRED", 403, "Confirm again"));
  expect((await handle(request())).status).toBe(403); expect(remove).not.toHaveBeenCalled();
});
it("T02/T09 requires explicit acknowledgement and same-origin request", async () => {
  expect((await handle(request({ acknowledgeDeletion: false }))).status).toBe(422);
  expect((await handle(request({}, "https://foreign.test"))).status).toBe(403); expect(remove).not.toHaveBeenCalled();
});
it("T09 removes only the authenticated account and clears confirmation cookies after success", async () => {
  const response = await handle(request()); expect(response.status).toBe(200); expect(remove).toHaveBeenCalledOnce(); expect(signOut).toHaveBeenCalledOnce(); expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
});
it("T09 never acknowledges a failed removal or exposes its internal details", async () => {
  remove.mockRejectedValue(new Error("private-canary")); const response = await handle(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private-canary"); expect(signOut).not.toHaveBeenCalled();
});
