import { describe, expect, it, vi } from "vitest";
import { createProviderAdapters, providerFetch, type ProviderInput } from "@/server/ai/providers";
const call = (provider: "gemini" | "groq"): ProviderInput => ({ model: provider === "gemini" ? "gemini-3.8-flash" : "openai/gpt-oss-120b", role: "explanation", system: "Select eligible codes.", input: "{}", schema: { type: "object", properties: { value: { type: "string" } }, required: ["value"], additionalProperties: false }, outputCap: 1024, signal: new AbortController().signal });
const response = (provider: "gemini" | "groq", text = '{"value":"ok"}') => provider === "gemini" ? {
  id: "authored-response", status: "completed", model: "gemini-3.8-flash", steps: [{ type: "model_output", content: [{ type: "text", text }] }], usage: { total_input_tokens: 12, total_output_tokens: 8, total_tokens: 20 },
} : { id: "authored-response", object: "chat.completion", created: 1, model: "openai/gpt-oss-120b", choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } };
for (const provider of ["gemini", "groq"] as const) describe(`M06 ${provider} SDK transport`, () => {
  it("uses strict structured output, no tools/storage and one bounded network request", async () => {
    let body: Record<string, unknown> = {};
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      body = JSON.parse(String(init?.body ?? (input instanceof Request ? await input.text() : "{}")));
      return Response.json(response(provider));
    });
    const result = await createProviderAdapters({ geminiApiKey: "authored-key", groqApiKey: "authored-key" }, fetcher)[provider](call(provider));
    expect(result.value).toEqual({ value: "ok" }); expect(result.usage.total_tokens).toBe(20); expect(fetcher).toHaveBeenCalledOnce();
    expect(body.tools).toBeUndefined(); expect(body.previous_interaction_id).toBeUndefined();
    if (provider === "gemini") { expect(body.store).toBe(false); expect(body.response_format).toMatchObject({ mime_type: "application/json" }); }
    else expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true } });
  });
  it.each([400, 401, 404, 429, 500, 503])("never stacks SDK retries for HTTP %i", async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("private-provider-error-canary", { status, headers: { "Retry-After": "123" } }));
    const promise = createProviderAdapters({ geminiApiKey: "authored-key", groqApiKey: "authored-key" }, fetcher)[provider](call(provider));
    await expect(promise).rejects.toMatchObject({ outcome: status === 429 ? "rate_limited" : status >= 500 ? "transient" : "configuration", ...(status === 429 ? { retryAfter: 123 } : {}) });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects malformed model JSON and keeps usage for reconciliation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response(provider, "not JSON")));
    await expect(createProviderAdapters({ geminiApiKey: "authored-key", groqApiKey: "authored-key" }, fetcher)[provider](call(provider))).rejects.toMatchObject({ outcome: "invalid", usage: { total_tokens: 20 } });
  });
});
it("rejects destination changes and excess/late bodies before parsing", async () => {
  const fetcher = vi.fn<typeof fetch>(); const controller = new AbortController();
  await expect(providerFetch("groq", controller.signal, fetcher)("https://evil.test")).rejects.toMatchObject({ outcome: "configuration" });
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValue(new Response("x".repeat(65537)));
  await expect(providerFetch("groq", controller.signal, fetcher)("https://api.groq.com/openai/v1/chat/completions")).rejects.toMatchObject({ outcome: "invalid" });
  const abort = new AbortController(); abort.abort();
  await expect(providerFetch("groq", abort.signal, fetcher)("https://api.groq.com/openai/v1/chat/completions")).rejects.toBeDefined();
});
it("honors the latest applicable explicit provider reset without exposing error bodies", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { message: "private-canary", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "120.5s" }] } }, { status: 429, headers: { "Retry-After": "30" } }));
  await expect(createProviderAdapters({ geminiApiKey: "authored", groqApiKey: "authored" }, fetcher).gemini(call("gemini"))).rejects.toMatchObject({ outcome: "rate_limited", retryAfter: 121 });
  fetcher.mockResolvedValue(new Response("private-canary", { status: 429, headers: { "retry-after": "2", "x-ratelimit-remaining-requests": "0", "x-ratelimit-reset-requests": "2m59.56s", "x-ratelimit-remaining-tokens": "10", "x-ratelimit-reset-tokens": "1h" } }));
  await expect(createProviderAdapters({ geminiApiKey: "authored", groqApiKey: "authored" }, fetcher).groq(call("groq"))).rejects.toMatchObject({ outcome: "rate_limited", retryAfter: 180 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
