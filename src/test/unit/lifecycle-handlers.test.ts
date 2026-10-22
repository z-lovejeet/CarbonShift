import { beforeEach, expect, it, vi } from "vitest";
import { createLifecycleHandlers } from "@/server/plans/lifecycle-handlers";
import { ApiError } from "@/server/http/errors";
const id = "8d46189a-7ef2-46f2-a674-aea5b026d06e", origin = "http://127.0.0.1:3000";
const repository = { detail: vi.fn(), replay: vi.fn(), commit: vi.fn() }, reauthenticate = vi.fn(), ingress = vi.fn(), actual = vi.fn();
const handle = createLifecycleHandlers({ origin: () => origin, now: () => "2026-10-21T12:00:00Z", actual, ingress, authenticate: async () => ({ userId: id, repository, reauthenticate }) });
const request = (input?: unknown, from = origin) => new Request(origin + `/api/v1/plans/${id}/reports`, { method: input === undefined ? "DELETE" : "POST", headers: { Origin: from, "Content-Type": "application/json", "Idempotency-Key": "stable-lifecycle-key" }, body: input === undefined ? undefined : JSON.stringify(input) });
beforeEach(() => { for (const mock of [...Object.values(repository), reauthenticate, ingress, actual]) mock.mockReset().mockResolvedValue(undefined); repository.replay.mockResolvedValue(null); });
it("T02/T09 rejects cross-origin writes and untrusted owner/totals/time overrides", async () => {
  expect((await handle(request({}, "https://foreign.test"), id, "report")).status).toBe(403);
  expect(ingress).not.toHaveBeenCalled();
  const base = { kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, correctsReportId: null, reason: "" };
  for (const extra of [{ ownerId: id }, { differenceMg: 0 }, { nowUtc: "2026-10-21T12:00:00Z" }]) expect((await handle(request({ ...base, ...extra }), id, "report")).status).toBe(422);
  expect(repository.commit).not.toHaveBeenCalled();
});
it("T09 requires a boolean profile answer and a reason for corrections", async () => {
  const base = { kind: "ran", reportedStartUtc: "2026-10-21T09:00:00Z", profileStillApplicable: null, correctsReportId: null, reason: "" };
  expect((await handle(request(base), id, "report")).status).toBe(422);
  expect((await handle(request({ ...base, profileStillApplicable: true, correctsReportId: id }), id, "report")).status).toBe(422);
});
it("T02/T09 checks deletion reauthentication before looking up or mutating data", async () => {
  reauthenticate.mockRejectedValue(new ApiError("REAUTH_REQUIRED", 403, "Confirm again"));
  expect((await handle(request(), id, "delete")).status).toBe(403); expect(repository.replay).not.toHaveBeenCalled();
});
it("T02/T09 conceals foreign/missing records and rate limits submissions", async () => {
  repository.detail.mockRejectedValue(new ApiError("NOT_FOUND", 404, "Not found"));
  const input = { kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, correctsReportId: null, reason: "" };
  expect((await handle(request(input), id, "report")).status).toBe(404);
  ingress.mockRejectedValue(new ApiError("RATE_LIMITED", 429, "Wait", true, 41));
  const response = await handle(request(input), id, "report"); expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("41");
});

it("T09 accepts a zero-byte DELETE stream while still rejecting actual body data", async () => {
  repository.replay.mockResolvedValue({ planId: id, planVersion: 2, reportId: null, resultId: null, changed: true, deleted: true });
  const empty = new Request(origin + `/api/v1/plans/${id}`, { method: "DELETE", headers: { Origin: origin, "Idempotency-Key": "delete-empty-stream" }, body: "" });
  expect(empty.body).not.toBeNull(); expect((await handle(empty, id, "delete")).status).toBe(200);
  expect((await handle(request("x"), id, "delete")).status).toBe(413);
});
