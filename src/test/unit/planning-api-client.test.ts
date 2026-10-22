import { afterEach, expect, it, vi } from "vitest";
import { planningApi, PlanningFailure } from "@/lib/planning-api";
const fetcher = vi.fn<typeof fetch>();
afterEach(() => vi.unstubAllGlobals());
it("sends only immutable acceptance references and its caller's retry key", async () => {
  vi.stubGlobal("fetch", fetcher);fetcher.mockResolvedValue(Response.json({ error: { code: "COMPARISON_EXPIRED", message: "private-canary" }, requestId: "c51b4405-f40b-4e42-8ce3-0461312b8e05" }, { status: 409 }));
  await expect(planningApi.save("c51b4405-f40b-4e42-8ce3-0461312b8e05", 1, "stable-retry-key")).rejects.toMatchObject({ code: "COMPARISON_EXPIRED", requestId: "c51b4405-f40b-4e42-8ce3-0461312b8e05" });
  const options = fetcher.mock.calls[0]![1]!;
  expect(JSON.parse(String(options.body))).toEqual({ comparisonId: "c51b4405-f40b-4e42-8ce3-0461312b8e05", comparisonVersion: 1 });
  expect(options.headers).toHaveProperty("Idempotency-Key", "stable-retry-key");expect(options.credentials).toBe("same-origin");
});
it("rejects malformed successful data and sanitizes unknown error text", async () => {
  vi.stubGlobal("fetch", fetcher);fetcher.mockResolvedValueOnce(Response.json({ data: { items: [] }, requestId: "bad-id" }));
  await expect(planningApi.page("cursor")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  fetcher.mockResolvedValueOnce(Response.json({ error: { code: "DATABASE_UNAVAILABLE", message: "private-canary" } }, { status: 503 }));
  try { await planningApi.page("cursor");throw new Error("Expected rejection"); } catch (error) { expect(error).toBeInstanceOf(PlanningFailure);expect((error as Error).message).not.toContain("canary"); }
});
it("turns network rejection into an uncertain failure rather than a successful save", async () => {
  vi.stubGlobal("fetch", fetcher);fetcher.mockRejectedValueOnce(new Error("network-secret"));
  await expect(planningApi.save("id", 1, "same-key")).rejects.toMatchObject({ code: "NETWORK_UNAVAILABLE" });
});
