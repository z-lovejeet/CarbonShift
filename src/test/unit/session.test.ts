import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@/server/db/clients", () => ({ createUserClient: async () => ({ auth: { getUser: mocks.user } }) }));
import { requireMember } from "@/server/auth/session";
beforeEach(() => mocks.user.mockReset());
it("uses a validated server identity rather than trusting cookie data", async () => {
  const id = "9d343c67-c744-4327-9a32-52991bc0a988";
  mocks.user.mockResolvedValue({ data: { user: { id, email: "authored@example.invalid" } }, error: null });
  expect((await requireMember()).userId).toBe(id);
  expect(mocks.user).toHaveBeenCalledOnce();
});
it("rejects missing, forged or expired sessions", async () => {
  for (const status of [400, 401, 403]) {
    mocks.user.mockResolvedValue({ data: { user: null }, error: { status } });
    await expect(requireMember()).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  }
});
it("distinguishes unavailable authentication from an absent session", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: { status: 500, message: "private-provider-canary" } });
  await expect(requireMember()).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE", status: 503 });
});
