import { z } from "zod";
import { AI_MODEL_IDS, AI_REGISTRY, type AiRole } from "./ai-registry";

const stamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/).refine((s) => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().replace(".000Z", "Z") === s);
const name = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const role = z.enum(["constraints", "explanation"]);
const unique = <T>(items: T[]) => new Set(items).size === items.length;
const modelSchema = z.strictObject({
  id: z.enum(AI_MODEL_IDS), enabled: z.boolean(), accessVerifiedAtUtc: stamp.nullable(),
  qualifiedRoles: z.array(role).max(2).refine(unique), bucketIds: z.array(name).max(16).refine(unique),
});
const bucketSchema = z.strictObject({
  id: name, provider: z.enum(["gemini", "groq"]), scopeAlias: name,
  metric: z.enum(["requests", "input_tokens", "output_tokens", "total_tokens"]),
  window: z.enum(["rolling_60s", "rolling_24h", "calendar_day"]), resetTimezone: z.string().max(64).nullable(),
  providerLimit: positive.nullable(), appLimit: positive.nullable(), verifiedAtUtc: stamp.nullable(),
}).superRefine((b, ctx) => {
  if (b.window !== "calendar_day" && b.resetTimezone !== null) ctx.addIssue({ code: "custom", message: "Rolling windows have no reset timezone" });
  if (b.window === "calendar_day") {
    try { if (!b.resetTimezone) throw new Error(); new Intl.DateTimeFormat("en", { timeZone: b.resetTimezone }); }
    catch { ctx.addIssue({ code: "custom", message: "A valid calendar timezone is required" }); }
  }
  if (b.appLimit !== null && b.providerLimit !== null && b.appLimit > b.providerLimit) ctx.addIssue({ code: "custom", message: "App limit exceeds provider limit" });
});
export const aiPolicySchema = z.strictObject({
  schemaVersion: z.literal(1), profile: z.enum(["eligible_free_development", "uk_public_groq_only", "uk_public_paid_gemini"]),
  roles: z.strictObject({ constraints: z.array(z.enum(AI_MODEL_IDS)).max(5).refine(unique), explanation: z.array(z.enum(AI_MODEL_IDS)).max(5).refine(unique) }),
  models: z.array(modelSchema).max(5), buckets: z.array(bucketSchema).max(40),
}).superRefine((p, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!unique(p.models.map((m) => m.id)) || !unique(p.buckets.map((b) => b.id))) issue("Duplicate model or bucket");
  for (const r of ["constraints", "explanation"] as const) for (const id of p.roles[r]) if (!p.models.some((m) => m.id === id)) issue("Role references missing model");
  for (const m of p.models) {
    const provider = AI_REGISTRY[m.id].provider;
    const buckets = m.bucketIds.map((id) => p.buckets.find((b) => b.id === id));
    if (buckets.some((b) => !b || b.provider !== provider)) issue("Model bucket/provider mismatch");
    if (m.enabled && (!m.accessVerifiedAtUtc || buckets.some((b) => !b?.verifiedAtUtc || !b.providerLimit || !b.appLimit))) issue("Enabled model needs verified access and budgets");
    if (m.enabled) {
      if (!buckets.some((b) => b?.metric === "requests" && b.window === "rolling_60s") ||
          !buckets.some((b) => b?.metric === "requests" && b.window !== "rolling_60s") ||
          !buckets.some((b) => b?.metric === "total_tokens" && b.window === "rolling_60s")) issue("Missing request/minute/day or token/minute budget");
      if (provider === "groq" && !buckets.some((b) => b?.metric === "total_tokens" && b.window === "rolling_24h")) issue("Groq daily token budget required");
      if (provider === "gemini" && p.profile === "uk_public_groq_only") issue("Gemini disabled for Groq-only profile");
      if (provider === "gemini" && buckets.some((b) => b?.metric === "requests" && b.window === "calendar_day" && b.resetTimezone !== "America/Los_Angeles")) issue("Gemini daily reset must use Pacific calendar");
      if (m.id === "gemini-3.8-flash" && !buckets.some((b) => b?.metric === "requests" && b.window === "calendar_day" && (b.appLimit ?? Infinity) <= 17)) issue("Flash ceiling is 17/day");
    }
  }
});
export type AiPolicy = z.infer<typeof aiPolicySchema>;
export function parseAiPolicy(text: string): AiPolicy {
  if (new TextEncoder().encode(text).length > 16384) throw new Error("AI policy is too large");
  return aiPolicySchema.parse(JSON.parse(text));
}
export function candidates(policy: AiPolicy, role: AiRole, evaluation = false) {
  return policy.roles[role].flatMap((id) => {
    const model = policy.models.find((m) => m.id === id);
    return model?.enabled && (evaluation || model.qualifiedRoles.includes(role)) ? [model] : [];
  });
}
export const disabledAiPolicy: AiPolicy = { schemaVersion: 1, profile: "eligible_free_development",
  roles: { constraints: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "openai/gpt-oss-120b"], explanation: ["openai/gpt-oss-120b", "gemini-3.5-flash-lite"] },
  models: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "openai/gpt-oss-120b"].map((id) => ({ id: id as AiPolicy["models"][number]["id"], enabled: false, accessVerifiedAtUtc: null, qualifiedRoles: [], bucketIds: [] })), buckets: [] };
