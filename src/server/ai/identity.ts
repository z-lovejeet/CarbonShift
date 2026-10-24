import "server-only";
import type { AiRole, AiVariant } from "@/config/ai-registry";
import { canonicalJson, subject } from "@/server/limits/budgets";
import { taskPrompt } from "./prompts";
export type AiBinding = { comparisonId: string; comparisonVersion: number };
export function inputFingerprint(secret: string, role: AiRole, input: unknown, binding?: AiBinding, variant?: AiVariant) {
  const prompt = taskPrompt(role, variant);
  return subject(secret, "ai-input", canonicalJson({ input, role, prompt: prompt.version, schema: prompt.schemaVersion, consent: true, ...(binding ? { binding } : {}) }));
}
