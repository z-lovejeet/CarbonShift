/** Code-owned destinations/capabilities. Policy cannot supply a provider URL. */
export const AI_REGISTRY = {
  "gemini-3.8-flash": { provider: "gemini", free: true },
  "gemini-3.6-flash": { provider: "gemini", free: true },
  "gemini-3.5-flash-lite": { provider: "gemini", free: true },
  "openai/gpt-oss-120b": { provider: "groq", free: true },
  "openai/gpt-oss-20b": { provider: "groq", free: true },
} as const;
export type ModelId = keyof typeof AI_REGISTRY;
export type AiProvider = "gemini" | "groq";
export type AiRole = "constraints" | "explanation";
export const AI_MODEL_IDS = Object.keys(AI_REGISTRY) as [ModelId, ...ModelId[]];
