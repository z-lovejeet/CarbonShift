import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlanHandlers } from "@/server/plans/handlers";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { createComparison } from "@/domain/scheduling";
import { ApiError } from "@/server/http/errors";
import { GridError } from "@/server/grid/errors";
import { constraints, snapshot, NOW } from "../fixtures/domain";
const record = createGridSnapshotRecord(snapshot());
const comparison = createComparison({ constraints: constraints(), snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, NOW);
const planId = "9d343c67-c744-4327-9a32-52991bc0a988", comparisonId = "4c343c67-c744-4327-9a32-52991bc0a988";
const plan = { schemaVersion: 1, id: planId, comparisonId, version: 1, mode: "live", status: "accepted", acceptedAtUtc: NOW, comparison,
  forecastSnapshot: record.snapshot, completion: "not_reported", publication: "private", latestReport: null, latestResult: null, reports: [], revisions: [] };
const repository = { comparison: vi.fn(), reserveComparisonQuota: vi.fn(), saveComparison: vi.fn(), accept: vi.fn(), detail: vi.fn(), page: vi.fn() };
const authenticate = vi.fn(), forecast = vi.fn(), ingress = vi.fn();
const handlers = createPlanHandlers({ authenticate, forecast, ingress, now: () => NOW, origin: () => "http://127.0.0.1:3000", hmacSecret: () => "isolated-test-hmac" });
const input = { geography: "GB_NATIONAL", timezone: "Europe/London", earliestStartUtc: "2026-10-21T07:00:00Z", deadlineUtc: "2026-10-21T11:00:00Z", durationMinutes: 60, energyWh: 1000,
  energyBasis: "user_estimate", blockedIntervals: [], baseline: { kind: "user_selected", startUtc: "2026-10-21T07:00:00Z" }, constraintsConfirmed: true };
function request(body: unknown, path = "/comparisons", headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/api/v1" + path, { method: "POST", headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => {
  ingress.mockReset().mockResolvedValue(undefined);
  authenticate.mockReset().mockResolvedValue({ userId: planId, repository });
  forecast.mockReset().mockResolvedValue(record);
  Object.values(repository).forEach((mock) => mock.mockReset());
  repository.accept.mockResolvedValue(plan); repository.detail.mockResolvedValue(plan);
  repository.page.mockResolvedValue({ items: [], nextCursor: null });
});
describe("T02/T07 private API contracts", () => {
  it("throttles invalid/repeated mutation ingress before grid/acceptance while reads remain available", async () => {
    ingress.mockRejectedValue(new ApiError("RATE_LIMITED", 429, "Wait", true, 47));
    const limited = await handlers.accept(request({ comparisonId, comparisonVersion: 1 }, "/plans", { "idempotency-key": "same-save-key" }));
    expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("47"); expect(repository.accept).not.toHaveBeenCalled();
    expect((await handlers.compare(request({ invalid: true }))).status).toBe(429); expect(forecast).not.toHaveBeenCalled();
    expect((await handlers.list(new Request("http://127.0.0.1:3000/api/v1/plans"))).status).toBe(200);
  });
  it("computes and persists a comparison from confirmed inputs and the trusted grid", async () => {
    const response = await handlers.compare(request(input));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ ...comparison, schemaVersion: 1, version: 1 });
    expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(repository.saveComparison).toHaveBeenCalledOnce();
    expect(repository.reserveComparisonQuota.mock.calls[0]![0]).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("normalizes the explicitly confirmed earliest-feasible baseline", async () => {
    const response = await handlers.compare(request({ ...input, baseline: { kind: "earliest_feasible" } }));
    expect((await response.json()).data.constraints.baselineOrigin).toBe("earliest_feasible_confirmed");
  });
  it.each([{ ...input, owner_id: planId }, { ...input, differenceMg: 0 }, { ...input, nowUtc: NOW }, { ...input, constraintsConfirmed: false }])("rejects client authority and unconfirmed fields", async (body) => {
    expect((await handlers.compare(request(body))).status).toBe(422);
    expect(forecast).not.toHaveBeenCalled();
  });
  it("denies missing sessions before grid or database calls", async () => {
    authenticate.mockRejectedValue(new ApiError("UNAUTHENTICATED", 401, "Sign in to continue."));
    expect((await handlers.compare(request(input))).status).toBe(401);
    expect(forecast).not.toHaveBeenCalled();
  });
  it("denies cross-origin writes before authentication", async () => {
    expect((await handlers.compare(request(input, "/comparisons", { origin: "https://evil.test" }))).status).toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
  });
  it("does not return success when forecast or persistence fails", async () => {
    forecast.mockRejectedValueOnce(new GridError("GRID_TIMEOUT", "canary", true));
    expect((await handlers.compare(request(input))).status).toBe(503);
    repository.saveComparison.mockRejectedValueOnce(new Error("database-private-canary"));
    const failed = await handlers.compare(request(input));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("canary");
  });
  it("enforces quota before calling the grid", async () => {
    repository.reserveComparisonQuota.mockRejectedValue(new ApiError("RATE_LIMITED", 429, "Try later", true));
    const response = await handlers.compare(request(input));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(forecast).not.toHaveBeenCalled();
  });
  it("accepts only the reviewed reference/version and validates the exact response", async () => {
    const response = await handlers.accept(request({ comparisonId, comparisonVersion: 1 }, "/plans", { "idempotency-key": "retry-key-123" }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(plan);
    expect(repository.accept).toHaveBeenCalledWith(comparisonId, 1, "retry-key-123", expect.stringMatching(/^[a-f0-9]{64}$/));
  });
  it("requires an idempotency key and refuses client totals", async () => {
    expect((await handlers.accept(request({ comparisonId, comparisonVersion: 1 }, "/plans"))).status).toBe(422);
    expect((await handlers.accept(request({ comparisonId, comparisonVersion: 1, ownerId: planId }, "/plans", { "idempotency-key": "retry-key-123" }))).status).toBe(422);
    expect(repository.accept).not.toHaveBeenCalled();
  });
  it("refuses a corrupted persisted plan response", async () => {
    repository.accept.mockResolvedValue({ ...plan, comparison: { ...comparison, differenceMg: 999 } });
    expect((await handlers.accept(request({ comparisonId, comparisonVersion: 1 }, "/plans", { "idempotency-key": "retry-key-123" }))).status).toBe(503);
  });
  it("bounds page size and refuses duplicate/unknown query fields", async () => {
    for (const query of ["?limit=21", "?owner_id=other", "?limit=1&limit=2"]) expect((await handlers.list(new Request("http://localhost/api/v1/plans" + query))).status).toBe(422);
    expect(repository.page).not.toHaveBeenCalled();
    expect((await handlers.list(new Request("http://localhost/api/v1/plans?limit=10"))).status).toBe(200);
    expect(repository.page).toHaveBeenCalledWith(10, undefined);
  });
  it("treats invalid or foreign plan references as not found", async () => {
    expect((await handlers.detail(new Request("http://localhost"), "not-a-uuid")).status).toBe(404);
    repository.detail.mockRejectedValue(new ApiError("NOT_FOUND", 404, "This plan was not found."));
    expect((await handlers.detail(new Request("http://localhost"), planId)).status).toBe(404);
  });
  it("rejects malformed, non-JSON and oversized bodies", async () => {
    const make = (body: string, type = "application/json") => new Request("http://localhost", { method: "POST", headers: { origin: "http://127.0.0.1:3000", "content-type": type }, body });
    expect((await handlers.compare(make("{"))).status).toBe(400);
    expect((await handlers.compare(make("{}", "text/plain"))).status).toBe(415);
    expect((await handlers.compare(make("x".repeat(16385)))).status).toBe(413);
  });
});

 it("reads the owner comparison and saved chart data without another provider call", async () => {
   repository.comparison.mockResolvedValue({ comparison: { ...comparison, id: comparisonId, schemaVersion: 1, version: 1 }, forecastSnapshot: record.snapshot });
   const response = await handlers.comparison(new Request("http://127.0.0.1:3000/api/v1/comparisons/" + comparisonId), comparisonId);
   expect(response.status).toBe(200);expect((await response.json()).data.forecastSnapshot).toEqual(record.snapshot);expect(forecast).not.toHaveBeenCalled();
 });
 it("conceals foreign comparisons and refuses malformed read IDs", async () => {
   repository.comparison.mockRejectedValue(new ApiError("NOT_FOUND", 404, "Not found"));
   expect((await handlers.comparison(new Request("http://127.0.0.1:3000"), comparisonId)).status).toBe(404);
   repository.comparison.mockClear();
   expect((await handlers.comparison(new Request("http://127.0.0.1:3000"), "not-an-id")).status).toBe(404);
   expect(repository.comparison).not.toHaveBeenCalled();
 });
