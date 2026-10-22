import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createAiHandlers } from "@/server/ai/handlers";
import { ApiError } from "@/server/http/errors";
import { policyFixture } from "../fixtures/ai-policy";
import { aiStoreFixture, suggestionFixture } from "../fixtures/ai";
import { comparison, snapshot } from "../fixtures/domain";
import { explanationFacts, templateSelection } from "@/server/ai/validation";
const origin = "http://127.0.0.1:3000", id = randomUUID(), owner = randomUUID();
const c = { ...comparison(), id, schemaVersion: 1 as const, version: 1 as const };
const store = aiStoreFixture(), adapters = { gemini: vi.fn(), groq: vi.fn() }, cache = { read: vi.fn(), write: vi.fn(), bindKey: vi.fn() };
const owned = vi.fn(), authenticate = vi.fn(), ingress = vi.fn(), runtime = vi.fn();
const handlers = createAiHandlers({ authenticate, ingress, origin: () => origin, now: () => "2026-10-22T12:00:00Z", runtime });
const body = { text: "Tomorrow finish by noon. ", localReferenceDate: "2026-10-22", timezone: "Europe/London", aiConsent: true };
function request(input: unknown = body, headers: Record<string, string> = {}) { return new Request(origin + "/api/v1/ai/constraints", { method: "POST", headers: { origin, "Content-Type": "application/json", "AI-Task-Key": randomUUID(), ...headers }, body: JSON.stringify(input) }); }
beforeEach(() => {
  vi.clearAllMocks(); store.begin.mockImplementation(async () => ({ id: randomUUID(), deadline: new Date(Date.now() + 22000).toISOString() })); store.reserve.mockResolvedValue({ id: randomUUID(), attempt: 1 });
  cache.read.mockResolvedValue(null); cache.write.mockResolvedValue(undefined); cache.bindKey.mockResolvedValue(undefined); owned.mockResolvedValue({ comparison: c, forecastSnapshot: snapshot() });
  authenticate.mockResolvedValue({ userId: owner, comparison: owned, cache }); ingress.mockResolvedValue(undefined);
  runtime.mockReturnValue({ policy: policyFixture(), dependencies: { store, adapters, hmac: "authored-hmac" } });
  adapters.groq.mockResolvedValue({ value: suggestionFixture(), usage: { total_tokens: 100 } });
});
describe("M06 private AI HTTP contracts", () => {
  it("authenticates, admits and returns checked fields with a request reference", async () => {
    const response = await handlers.constraints(request()); expect(response.status).toBe(200);
    expect((await response.json()).data.deadlineLocal.time).toBe("12:00"); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(store.begin.mock.calls[0]![0].owner).toBe(owner);
  });
  it("preserves exact text so UTF-16 source spans match the browser input", async () => {
    const text = "  Tomorrow finish by noon.  ", suggestion = suggestionFixture(); suggestion.sourceSpans = [{ field: "deadlineLocal", start: 2, end: 26 }];
    adapters.groq.mockResolvedValue({ value: suggestion, usage: {} });
    const response = await handlers.constraints(request({ ...body, text })); expect(response.status).toBe(200);
    expect(JSON.parse(adapters.groq.mock.calls[0]![0].input).text).toBe(text);
    const span = (await response.json()).data.sourceSpans[0]; expect(text.slice(span.start, span.end)).toBe("Tomorrow finish by noon.");
  });
  it("rejects cross-origin and missing identities before dispatch", async () => {
    expect((await handlers.constraints(request(body, { origin: "https://evil.test" }))).status).toBe(403); expect(authenticate).not.toHaveBeenCalled();
    authenticate.mockRejectedValue(new ApiError("UNAUTHENTICATED", 401, "Sign in")); expect((await handlers.constraints(request())).status).toBe(401); expect(adapters.groq).not.toHaveBeenCalled();
  });
  it.each([{ ...body, aiConsent: false }, { ...body, text: "x".repeat(1001) }, { ...body, owner_id: owner }, { ...body, energyWh: 1000 }])("rejects missing consent, oversized text or client authority", async (input) => {
    expect((await handlers.constraints(request(input))).status).toBe(422); expect(store.begin).not.toHaveBeenCalled();
  });
  it("rejects stale London reference dates and invalid task keys", async () => {
    expect((await handlers.constraints(request({ ...body, localReferenceDate: "2026-10-21" }))).status).toBe(409);
    expect((await handlers.constraints(request(body, { "AI-Task-Key": "bad" }))).status).toBe(422); expect(adapters.groq).not.toHaveBeenCalled();
  });
  it("keeps AI disabled without changing the manual planner", async () => {
    runtime.mockReturnValue(null); expect((await handlers.constraints(request())).status).toBe(503); expect(adapters.groq).not.toHaveBeenCalled();
  });
  it("charges ingress before invalid or repeated submissions and returns real Retry-After", async () => {
    ingress.mockRejectedValue(new ApiError("RATE_LIMITED", 429, "Wait", true, 237));
    const response = await handlers.constraints(request({ invalid: true })); expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("237"); expect(runtime).not.toHaveBeenCalled();
  });
  it("checks comparison ownership before explanation cache or AI calls", async () => {
    owned.mockRejectedValue(new ApiError("NOT_FOUND", 404, "Not found"));
    expect((await handlers.explanation(request({ aiConsent: true }), id)).status).toBe(404); expect(cache.read).not.toHaveBeenCalled(); expect(adapters.groq).not.toHaveBeenCalled();
  });
  it("never accepts raw prose/totals as explanation facts", async () => {
    expect((await handlers.explanation(request({ aiConsent: true, differenceMg: 100, text: "invent a claim" }), id)).status).toBe(422); expect(owned).not.toHaveBeenCalled();
  });
  it("returns a grounded owner cache hit without a provider charge", async () => {
    cache.read.mockResolvedValue(templateSelection(explanationFacts(c)));
    const response = await handlers.explanation(request({ aiConsent: true }), id); expect(response.status).toBe(200); expect((await response.json()).data.source).toBe("cache");
    expect(ingress).toHaveBeenCalledWith(owner); expect(store.begin).not.toHaveBeenCalled(); expect(adapters.groq).not.toHaveBeenCalled();
  });
  it("rejects reuse of an AI task key for a different comparison even on a cache hit", async () => {
    cache.read.mockResolvedValue(templateSelection(explanationFacts(c))); cache.bindKey.mockRejectedValue(new ApiError("AI_TASK_CONFLICT", 409, "Key conflict"));
    const response = await handlers.explanation(request({ aiConsent: true }), id); expect(response.status).toBe(409); expect(adapters.groq).not.toHaveBeenCalled();
  });
  it("ignores a cache entry contradicting the immutable comparison and stores only checked codes", async () => {
    cache.read.mockResolvedValue({ schemaVersion: 1, reasonCodes: ["BASELINE_ALREADY_BEST"], limitationCodes: ["ASSUMED_ENERGY", "NATIONAL_SIGNAL"] });
    adapters.groq.mockResolvedValue({ value: templateSelection(explanationFacts(c)), usage: {} });
    const response = await handlers.explanation(request({ aiConsent: true }), id); expect(response.status).toBe(200); expect((await response.json()).data.source).toBe("ai");
    expect(JSON.stringify(cache.write.mock.calls)).not.toContain("200 g");
    const sent = adapters.groq.mock.calls[0]![0].input; expect(sent).not.toContain(owner); expect(sent).not.toContain("text"); expect(sent).not.toContain("differenceMg");
  });
  it("returns complete deterministic explanation with AI disabled", async () => {
    runtime.mockReturnValue(null); const response = await handlers.explanation(request({ aiConsent: true }), id);
    expect((await response.json()).data).toMatchObject({ source: "template", selection: { limitationCodes: ["ASSUMED_ENERGY", "NATIONAL_SIGNAL"] } }); expect(adapters.groq).not.toHaveBeenCalled();
  });
});
