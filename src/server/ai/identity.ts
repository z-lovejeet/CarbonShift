import "server-only";
import type { AiRole } from "@/config/ai-registry";
import { canonicalJson, subject } from "@/server/limits/budgets";
import { PROMPT_VERSION } from "./prompts";
export type AiBinding = { comparisonId: string; comparisonVersion: number };
export function inputFingerprint(secret: string, role: AiRole, input: unknown, binding?: AiBinding) {
  return subject(secret, "ai-input", canonicalJson({ input, role, prompt: PROMPT_VERSION[role], schema: 1, consent: true, ...(binding ? { binding } : {}) }));
}
