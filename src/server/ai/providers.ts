import "server-only";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { z } from "zod";
import { AI_REGISTRY, type AiProvider, type AiRole, type ModelId } from "@/config/ai-registry";
import type { Outcome, Usage } from "./store";

export class ProviderFailure extends Error {
  constructor(readonly outcome: Exclude<Outcome, "succeeded">, readonly retryAfter = 60, readonly usage: Usage = {}) { super("AI provider request did not complete."); }
}
export type ProviderInput = { model: ModelId; role: AiRole; system: string; input: string; schema: Record<string, unknown>; outputCap: number; signal: AbortSignal };
export type ProviderAdapter = (input: ProviderInput) => Promise<{ value: unknown; usage: Usage }>;
const usageSchema = z.object({ input_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(), output_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(), total_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() });
function safeUsage(input: unknown): Usage { const result = usageSchema.safeParse(input); return result.success ? result.data : {}; }
function durationSeconds(raw: string | null): number | null {
  if (!raw || raw.length > 48) return null;
  const m = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d{1,9})?)s)?(?:(\d+)ms)?$/.exec(raw);
  if (!m || !m.slice(1).some(Boolean)) return null;
  const value = Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0) + Number(m[5] ?? 0) / 1000;
  return Number.isFinite(value) ? Math.ceil(value) : null;
}
async function retrySeconds(response: Response, provider: AiProvider, signal: AbortSignal) {
  const raw = response.headers.get("retry-after");
  const header = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? Math.ceil((Date.parse(raw) - Date.now()) / 1000) : NaN;
  const hints = Number.isFinite(header) ? [header] : [];
  if (provider === "groq") for (const metric of ["requests", "tokens"]) {
    const remaining = response.headers.get(`x-ratelimit-remaining-${metric}`);
    if (remaining !== null && Number(remaining) <= 0) {
      const reset = durationSeconds(response.headers.get(`x-ratelimit-reset-${metric}`)); if (reset !== null) hints.push(reset);
    }
  }
  // Read only bounded retry metadata, discard every provider message/project detail.
  const reader = response.body?.getReader();
  if (reader) {
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      const chunks: Uint8Array[] = []; let size = 0;
      while (!signal.aborted && size <= 16384) {
        const item = await reader.read(); if (item.done) break;
        size += item.value.byteLength; if (size > 16384) { cancel(); break; } chunks.push(item.value);
      }
      if (provider === "gemini" && !signal.aborted && size <= 16384) {
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
        const detail = z.object({ error: z.object({ details: z.array(z.object({ "@type": z.string(), retryDelay: z.string().optional() })).max(32).optional() }) }).safeParse(body);
        for (const item of detail.success ? detail.data.error.details ?? [] : []) if (item["@type"] === "type.googleapis.com/google.rpc.RetryInfo") {
          const delay = durationSeconds(item.retryDelay ?? null); if (delay !== null) hints.push(delay);
        }
      }
    } catch { /* Malformed/oversized errors never escape as raw SDK messages. */ }
    finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  }
  return Math.max(1, Math.min(172800, hints.length ? Math.max(...hints) : 60));
}
/** One fetch per admitted attempt, bounded bytes/redirects even if an SDK changes defaults. */
export function providerFetch(provider: AiProvider, signal: AbortSignal, transport: typeof fetch = fetch): typeof fetch {
  let dispatched = false;
  return async (input, init) => {
    if (dispatched) throw new ProviderFailure("configuration");
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== (provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.groq.com") || url.username || url.password) throw new ProviderFailure("configuration");
    signal.throwIfAborted(); dispatched = true;
    const response = await transport(input, { ...init, redirect: "error", signal, cache: "no-store" });
    if (signal.aborted) { await response.body?.cancel().catch(() => {}); throw new ProviderFailure("transient"); }
    if (!response.ok) {
      if (response.status === 429) throw new ProviderFailure("rate_limited", await retrySeconds(response, provider, signal));
      await response.body?.cancel().catch(() => {});
      throw new ProviderFailure(response.status >= 500 || response.status === 408 ? "transient" : "configuration");
    }
    if (Number(response.headers.get("content-length")) > 65536) { await response.body?.cancel().catch(() => {}); throw new ProviderFailure("invalid"); }
    const reader = response.body?.getReader(); if (!reader) throw new ProviderFailure("invalid");
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", cancel, { once: true });
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const item = await reader.read(); if (item.done) break;
        length += item.value.byteLength;
        if (length > 65536) { cancel(); throw new ProviderFailure("invalid"); }
        chunks.push(item.value);
      }
      if (signal.aborted) throw new ProviderFailure("transient");
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return new Response(bytes, { status: response.status, headers: { "content-type": "application/json" } });
    } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  };
}
function parseOutput(text: string | undefined | null, usage: Usage) {
  if (!text || Buffer.byteLength(text) > 32768) throw new ProviderFailure("invalid", 60, usage);
  try { return JSON.parse(text) as unknown; } catch { throw new ProviderFailure("invalid", 60, usage); }
}
function normalizeFailure(error: unknown): never {
  if (error instanceof ProviderFailure) throw error;
  // SDKs may wrap the transport error; recover only our static cause, never expose SDK text.
  if (error && typeof error === "object" && "cause" in error && error.cause instanceof ProviderFailure) throw error.cause;
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    throw new ProviderFailure(error.status === 429 ? "rate_limited" : error.status >= 500 || error.status === 408 ? "transient" : "configuration");
  }
  throw new ProviderFailure("transient");
}
function trackedTransport(provider: AiProvider, signal: AbortSignal, transport: typeof fetch) {
  const bounded = providerFetch(provider, signal, transport); let failure: ProviderFailure | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    try { return await bounded(input, init); }
    catch (error) { if (error instanceof ProviderFailure) failure = error; throw error; }
  };
  return { fetch: fetcher, failure: () => failure };
}
export function createProviderAdapters(keys: { geminiApiKey: string | null; groqApiKey: string }, transport: typeof fetch = fetch): Record<AiProvider, ProviderAdapter> {
  return {
    async gemini(input) {
      if (!keys.geminiApiKey || AI_REGISTRY[input.model].provider !== "gemini") throw new ProviderFailure("configuration");
      const tracked = trackedTransport("gemini", input.signal, transport);
      try {
        const client = new GoogleGenAI({ apiKey: keys.geminiApiKey, httpOptions: { fetch: tracked.fetch } });
        const response = await client.interactions.create({ model: input.model, system_instruction: input.system, input: input.input,
          response_format: { type: "text", mime_type: "application/json", schema: input.schema },
          generation_config: { max_output_tokens: input.outputCap }, store: false, stream: false }, { maxRetries: 0, signal: input.signal });
        const usage = safeUsage({ input_tokens: response.usage?.total_input_tokens, output_tokens: response.usage?.total_output_tokens, total_tokens: response.usage?.total_tokens });
        if (response.status !== "completed") throw new ProviderFailure(response.status === "failed" ? "refused" : "invalid", 60, usage);
        return { value: parseOutput(response.output_text, usage), usage };
      } catch (error) { return normalizeFailure(tracked.failure() ?? error); }
    },
    async groq(input) {
      if (AI_REGISTRY[input.model].provider !== "groq") throw new ProviderFailure("configuration");
      const tracked = trackedTransport("groq", input.signal, transport);
      try {
        const client = new Groq({ apiKey: keys.groqApiKey, maxRetries: 0, fetch: tracked.fetch });
        const response = await client.chat.completions.create({ model: input.model, messages: [{ role: "system", content: input.system }, { role: "user", content: input.input }],
          response_format: { type: "json_schema", json_schema: { name: `${input.role}_v1`, strict: true, schema: input.schema } },
          max_completion_tokens: input.outputCap, stream: false }, { maxRetries: 0, signal: input.signal });
        const usage = safeUsage({ input_tokens: response.usage?.prompt_tokens, output_tokens: response.usage?.completion_tokens, total_tokens: response.usage?.total_tokens });
        const choice = response.choices[0];
        if (choice?.message && "refusal" in choice.message && choice.message.refusal) throw new ProviderFailure("refused", 60, usage);
        if (choice?.finish_reason !== "stop") throw new ProviderFailure(String(choice?.finish_reason) === "content_filter" ? "refused" : "invalid", 60, usage);
        return { value: parseOutput(choice.message.content, usage), usage };
      } catch (error) { return normalizeFailure(tracked.failure() ?? error); }
    },
  };
}
