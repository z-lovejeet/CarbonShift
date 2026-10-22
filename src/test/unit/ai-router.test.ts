import { afterEach, describe, expect, it, vi } from "vitest";
import { runAiTask } from "@/server/ai/router";
import { ProviderFailure, type ProviderAdapter } from "@/server/ai/providers";
import { ApiError } from "@/server/http/errors";
import { policyFixture } from "../fixtures/ai-policy";
import { aiStoreFixture } from "../fixtures/ai";
import type { AiPolicy } from "@/config/ai-policy";

function fixture(gemini = false) {
  const policy = policyFixture();
  if (gemini) {
    policy.profile = "eligible_free_development";
    const source = policy.models[0]!;
    for (const id of ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"] as const) {
      policy.models.unshift({ ...source, id, bucketIds: source.bucketIds.map((key) => id + key) });
      policy.buckets.push(...policyFixture().buckets.map((b) => ({ ...b, id: id + b.id, provider: "gemini" as const })));
    }
    policy.roles.constraints = policy.models.map((m) => m.id);
  }
  const store = aiStoreFixture(), gem = vi.fn<ProviderAdapter>().mockResolvedValue({ value: { checked: true }, usage: { total_tokens: 25 } }), groq = vi.fn<ProviderAdapter>().mockResolvedValue({ value: { checked: true }, usage: { total_tokens: 25 } });
  const input = { owner: "owner", actor: "owner", key: "key", role: "constraints" as const, policy, input: { text: "authored text" }, validate: (v: unknown) => { if (!v || typeof v !== "object" || !("checked" in v)) throw new Error(); return v; } };
  return { store, gem, groq, input, dependencies: { store, hmac: "authored-hmac", adapters: { gemini: gem, groq } } };
}
afterEach(() => vi.useRealTimers());
describe("M06 bounded router", () => {
  it("persists intent before dispatch and records usage without raw input", async () => {
    const f = fixture(); await runAiTask(f.input, f.dependencies);
    expect(f.store.reserve.mock.invocationCallOrder[0]).toBeLessThan(f.groq.mock.invocationCallOrder[0]!);
    expect(JSON.stringify(f.store.begin.mock.calls)).not.toContain("authored text");
    expect(f.store.finishAttempt).toHaveBeenCalledWith(expect.any(String), "succeeded", expect.any(Number), { total_tokens: 25 }, expect.any(Array));
  });
  it("derives the UTF-16 source bound from exact text rather than trusting a supplied length", async () => {
    const f = fixture();
    await runAiTask({ ...f.input, input: { text: "Wash 🧺 tomorrow", textUtf16Length: 999 } }, f.dependencies);
    expect(JSON.parse(f.groq.mock.calls[0]![0].input)).toEqual({ text: "Wash 🧺 tomorrow", textUtf16Length: "Wash 🧺 tomorrow".length });
    expect(JSON.stringify(f.store.begin.mock.calls)).not.toContain("Wash");
  });
  it("skips capped entries without a call and uses the first candidate with capacity", async () => {
    const f = fixture(true); f.store.reserve.mockRejectedValueOnce(new ApiError("AI_RATE_LIMITED", 429, "cap", true, 8000));
    await runAiTask(f.input, f.dependencies); expect(f.gem).toHaveBeenCalledOnce(); expect(f.gem.mock.calls[0]![0].model).toBe("gemini-3.6-flash");
  });
  it("prefers the other provider after a Gemini failure, at most two actual attempts", async () => {
    const f = fixture(true); f.gem.mockRejectedValue(new ProviderFailure("transient")); f.groq.mockRejectedValue(new ProviderFailure("transient"));
    await expect(runAiTask(f.input, f.dependencies)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(f.gem).toHaveBeenCalledOnce(); expect(f.groq).toHaveBeenCalledOnce(); expect(f.store.reserve).toHaveBeenCalledTimes(2);
  });
  it.each(["configuration", "refused"] as const)("stops on %s without routing around it", async (outcome) => {
    const f = fixture(true); f.gem.mockRejectedValue(new ProviderFailure(outcome));
    await expect(runAiTask(f.input, f.dependencies)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" }); expect(f.groq).not.toHaveBeenCalled();
  });
  it("treats schema/semantic failure as one accounted attempt", async () => {
    const f = fixture(true); f.gem.mockResolvedValue({ value: { invalid: true }, usage: { total_tokens: 50 } });
    await runAiTask(f.input, f.dependencies); expect(f.groq).toHaveBeenCalledOnce();
    expect(f.store.finishAttempt.mock.calls[0]).toEqual([expect.any(String), "invalid", expect.any(Number), { total_tokens: 50 }, expect.any(Array), 60]);
  });
  it("returns a completed clarification without another model call", async () => {
    const f = fixture(true); f.gem.mockResolvedValue({ value: { checked: true, questions: ["clarify"] }, usage: {} });
    await runAiTask(f.input, f.dependencies); expect(f.groq).not.toHaveBeenCalled();
  });
  it("fails closed when admission is unavailable or task key is already running", async () => {
    const f = fixture(); f.store.begin.mockRejectedValue(new ApiError("AI_TASK_IN_PROGRESS", 409, "running"));
    await expect(runAiTask(f.input, f.dependencies)).rejects.toMatchObject({ code: "AI_TASK_IN_PROGRESS" }); expect(f.groq).not.toHaveBeenCalled();
    f.store.begin.mockResolvedValue({ id: "id", deadline: new Date(Date.now() + 10000).toISOString() }); f.store.reserve.mockRejectedValue(new Error("DB offline"));
    await expect(runAiTask(f.input, f.dependencies)).rejects.toThrow(); expect(f.groq).not.toHaveBeenCalled();
  });
  it("returns the earliest fully eligible candidate retry time when all quotas block", async () => {
    const f = fixture(true); const delays = [1000, 700, 900, 300];
    f.store.reserve.mockImplementation(async () => { throw new ApiError("AI_RATE_LIMITED", 429, "cap", true, delays.shift()); });
    await expect(runAiTask(f.input, f.dependencies)).rejects.toMatchObject({ status: 429, retryAfterSeconds: 300 }); expect(f.gem).not.toHaveBeenCalled(); expect(f.groq).not.toHaveBeenCalled();
  });
  it("honors the primary and whole-task deadlines even when a transport never resolves", async () => {
    vi.useFakeTimers(); const f = fixture(true); f.gem.mockImplementation(() => new Promise(() => {})); f.groq.mockImplementation(() => new Promise(() => {}));
    const pending = runAiTask(f.input, f.dependencies); const assertion = expect(pending).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    await vi.advanceTimersByTimeAsync(22000); await assertion; expect(f.gem).toHaveBeenCalledOnce(); expect(f.groq).toHaveBeenCalledOnce();
  });
  it("does not dispatch when the admission round-trip consumed the deadline", async () => {
    vi.useFakeTimers(); const f = fixture(); f.store.reserve.mockImplementation(async () => { vi.advanceTimersByTime(23000); return { id: "run", attempt: 1 }; });
    await expect(runAiTask(f.input, f.dependencies)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" }); expect(f.groq).not.toHaveBeenCalled();
  });
  it("evaluates exactly one caller-selected unpromoted candidate", async () => {
    const f = fixture(); f.input.policy.models[0]!.qualifiedRoles = [];
    await runAiTask({ ...f.input, evaluation: true, owner: null, model: "openai/gpt-oss-120b" }, f.dependencies);
    expect(f.groq).toHaveBeenCalledOnce(); expect(f.store.begin.mock.calls[0]![0].budgets).toEqual([]);
  });
  it("excludes unqualified and disabled candidates from web traffic", async () => {
    const f = fixture(); f.input.policy.models[0]!.qualifiedRoles = [];
    await expect(runAiTask(f.input, f.dependencies)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" }); expect(f.store.begin).not.toHaveBeenCalled();
    const p: AiPolicy = f.input.policy; p.models[0]!.enabled = false;
    await expect(runAiTask({ ...f.input, evaluation: true }, f.dependencies)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });
  it("freezes the policy snapshot before asynchronous admission", async () => {
    const f = fixture(); f.store.begin.mockImplementation(async () => { f.input.policy.models[0]!.enabled = false; f.input.policy.buckets[0]!.appLimit = 1; return { id: "task", deadline: new Date(Date.now() + 22000).toISOString() }; });
    await runAiTask(f.input, f.dependencies); expect(f.groq).toHaveBeenCalledOnce(); expect(f.store.reserve.mock.calls[0]![0].budgets.find((b) => b.limit === 30)).toBeDefined();
  });
  it("cancels an abandoned request without refunding its attempt or starting a fallback", async () => {
    const f = fixture(true), controller = new AbortController(); f.gem.mockImplementation(() => new Promise(() => {}));
    const pending = runAiTask({ ...f.input, signal: controller.signal }, f.dependencies); const assertion = expect(pending).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    await vi.waitFor(() => expect(f.gem).toHaveBeenCalledOnce()); controller.abort(); await assertion;
    expect(f.gem.mock.calls[0]![0].signal.aborted).toBe(true); expect(f.groq).not.toHaveBeenCalled(); expect(f.store.finishAttempt.mock.calls[0]![1]).toBe("unknown");
  });
});
