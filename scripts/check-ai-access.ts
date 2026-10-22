import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";
import { AI_REGISTRY } from "../src/config/ai-registry";
const source = { ...parse(await readFile(".env.local", "utf8")), ...process.env };
async function catalog(provider: "gemini" | "groq") {
  const key = source[provider === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY"];
  if (!key) return { provider, status: "key_absent", visibleCandidates: [] };
  try {
    const response = await fetch(provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100" : "https://api.groq.com/openai/v1/models", {
      headers: provider === "gemini" ? { "x-goog-api-key": key } : { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000), redirect: "error", cache: "no-store",
    });
    if (!response.ok) { await response.body?.cancel(); return { provider, status: `http_${response.status}`, visibleCandidates: [] }; }
    const reader = response.body!.getReader(), chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 1048576) { await reader.cancel(); throw new Error(); } chunks.push(part.value); } }
    finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object") throw new Error();
    const rows = Reflect.get(value, provider === "gemini" ? "models" : "data"); if (!Array.isArray(rows)) throw new Error();
    const ids = rows.flatMap((r: unknown) => { if (!r || typeof r !== "object") return []; const id = Reflect.get(r, provider === "gemini" ? "name" : "id"); return typeof id === "string" ? [id.replace(/^models\//, "")] : []; });
    return { provider, status: "authenticated_catalog_read", visibleCandidates: Object.entries(AI_REGISTRY).filter(([id, m]) => m.provider === provider && ids.includes(id)).map(([id]) => id), partialListing: Boolean(Reflect.get(value, "nextPageToken")) };
  } catch { return { provider, status: "unavailable_or_invalid", visibleCandidates: [] }; }
}
const providers = await Promise.all([catalog("gemini"), catalog("groq")]);
const report = { checkedAtUtc: new Date().toISOString(), operation: "authenticated model catalog GET only", inferenceRequests: 0, accountTier: "builder-reported-free", accountQuotasVerified: false, inferenceAccessVerified: false, roleQualityVerified: false, providers };
await writeFile("research/phase-6/provider-catalog-access.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
