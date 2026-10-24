import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  ingress: vi.fn(), member: vi.fn(), page: vi.fn(), detail: vi.fn(), accept: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ requireMember: mocks.member }));
vi.mock("@/server/db/clients", () => ({ databaseConfiguration: () => ({ origin: "https://example.invalid", hmac: "fixture" }), createServiceClient: () => ({}) }));
vi.mock("@/server/limits/ingress", () => ({ mutationIngress: mocks.ingress }));
vi.mock("@/server/schedules/repository", () => ({ createScheduleRepository: () => ({ page: mocks.page, detail: mocks.detail, accept: mocks.accept }) }));
import { scheduleRequest } from "@/server/schedules/handlers";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ userId: "fixture-member", client: {} });
  mocks.page.mockResolvedValue({ items: [], nextCursor: null });
  mocks.detail.mockResolvedValue({ id: "fixture" });
  mocks.ingress.mockResolvedValue(undefined);
});
it("keeps authenticated schedule reads out of the mutation budget", async () => {
  expect((await scheduleRequest(new Request("https://example.invalid/api/v2/schedules?limit=5"), "list")).status).toBe(200);
  expect((await scheduleRequest(new Request("https://example.invalid/api/v2/schedules/4b004729-061e-482d-bf22-d51f06bf1222"), "detail", "4b004729-061e-482d-bf22-d51f06bf1222")).status).toBe(200);
  expect(mocks.member).toHaveBeenCalledTimes(2);
  expect(mocks.ingress).not.toHaveBeenCalled();
  expect(mocks.page).toHaveBeenCalledWith(5, undefined);
});
it("rejects ambiguous and unsupported paging fields before querying records", async () => {
  for (const query of ["limit=1&limit=2", "cursor=a&cursor=b", "owner_id=someone", "limit=21"]) {
    expect((await scheduleRequest(new Request(`https://example.invalid/api/v2/schedules?${query}`), "list")).status).toBe(422);
  }
  expect(mocks.page).not.toHaveBeenCalled();
});
it("retains mutation ingress and same-origin checks for schedule writes", async () => {
  const request = (origin: string) => new Request("https://example.invalid/api/v2/schedules", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: "{}" });
  expect((await scheduleRequest(request("https://foreign.invalid"), "accept")).status).toBe(403);
  expect(mocks.member).not.toHaveBeenCalled();
  expect((await scheduleRequest(request("https://example.invalid"), "accept")).status).toBe(422);
  expect(mocks.ingress).toHaveBeenCalledWith("fixture-member");
  expect(mocks.accept).not.toHaveBeenCalled();
});
