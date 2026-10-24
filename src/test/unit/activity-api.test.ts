import { describe, expect, it, vi } from "vitest";
import { createActivityHandlers } from "@/server/activities/handlers";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { ApiError } from "@/server/http/errors";
import { snapshot, NOW } from "../fixtures/domain";

const input = { schemaVersion: 2, startUtc: "2026-10-21T07:00:00Z", activity: {
  schemaVersion: 2, id: "tv", category: "television", name: "Watch TV", durationMinutes: 60, quantity: 1,
  energy: { kind: "average_power", powerMw: 100000, origin: "user_estimate", confirmed: true },
} };
const request = (value: unknown = input, origin = "http://127.0.0.1:3000") => new Request("http://127.0.0.1:3000/api/v2/activities/simulate", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(value) });
function setup() {
  const record = createGridSnapshotRecord(snapshot([100, 300]));
  const deps = { origin: () => "http://127.0.0.1:3000", requireMember: vi.fn(async () => ({ userId: "owner" })), admit: vi.fn(async () => {}),
    sources: { getForecast: vi.fn(async () => record), getActual: vi.fn(async () => record) }, nowUtc: vi.fn(() => NOW) };
  return { deps, handlers: createActivityHandlers(deps), record };
}
describe("v2 simulation API", () => {
  it("uses the clock after source retrieval to validate a newly fetched forecast", async () => {
    const { deps, handlers } = setup();
    deps.sources.getForecast.mockResolvedValue(createGridSnapshotRecord({ ...snapshot([100, 300]), retrievedAtUtc: "2026-10-21T06:00:03Z" }));
    deps.nowUtc.mockReturnValueOnce(NOW).mockReturnValue("2026-10-21T06:00:04Z");
    const response = await handlers.simulate(request()); const body = await response.json();
    expect(response.status).toBe(200); expect(body.data.dataStatus).toBe("available");
  });
  it("returns source provenance and computed values, rejecting injected totals", async () => {
    const { handlers } = setup();
    const response = await handlers.simulate(request()); const body = await response.json();
    expect(body.data.estimate).toMatchObject({ energyMwh: 100000, estimatedMg: 20000 }); expect(body.data.grid.snapshot.license).toBe("CC BY 4.0");
    expect((await handlers.simulate(request({ ...input, estimatedMg: 0 }))).status).toBe(422);
  });
  it("preserves energy with unavailable CO₂ during a source outage", async () => {
    const { deps, handlers } = setup(); deps.sources.getForecast.mockRejectedValue(new Error("private provider detail"));
    const response = await handlers.simulate(request()); const body = await response.json();
    expect(body.data).toMatchObject({ dataStatus: "unavailable", estimate: { energyMwh: 100000, estimatedMg: null }, grid: null });
    expect(JSON.stringify(body)).not.toContain("private provider detail");
  });
  it("rejects authentication/origin/rate failures before provider traffic", async () => {
    const { deps, handlers } = setup();
    expect((await handlers.simulate(request(input, "https://elsewhere.invalid"))).status).toBe(403);
    deps.requireMember.mockRejectedValue(new ApiError("UNAUTHENTICATED", 401, "Sign in."));
    expect((await handlers.simulate(request())).status).toBe(401); expect(deps.sources.getForecast).not.toHaveBeenCalled();
  });
  it("rejects unbounded future/historical input and unknown references", async () => {
    const { deps, handlers } = setup();
    expect((await handlers.simulate(request({ ...input, startUtc: "2026-10-25T07:00:00Z" }))).status).toBe(422);
    expect((await handlers.simulate(request({ ...input, activity: { ...input.activity, energy: { kind: "reference", profileId: "unknown", profileVersion: 1, confirmed: true } } }))).status).toBe(422);
    expect(deps.sources.getForecast).not.toHaveBeenCalled();
  });
});
