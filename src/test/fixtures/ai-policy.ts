import type { AiPolicy } from "@/config/ai-policy";
/** Authored offline configuration. No claim about an actual account or model quality. */
export function policyFixture(): AiPolicy {
  const verifiedAtUtc = "2026-10-22T00:00:00Z";
  const specs = [["rpm", "requests", "rolling_60s", 30], ["rpd", "requests", "rolling_24h", 1000], ["tpm", "total_tokens", "rolling_60s", 8000], ["tpd", "total_tokens", "rolling_24h", 200000]] as const;
  return { schemaVersion: 1, profile: "uk_public_groq_only", roles: { constraints: ["openai/gpt-oss-120b"], explanation: ["openai/gpt-oss-120b"] },
    models: [{ id: "openai/gpt-oss-120b", enabled: true, accessVerifiedAtUtc: verifiedAtUtc, qualifiedRoles: ["constraints", "explanation"], bucketIds: specs.map(([id]) => id) }],
    buckets: specs.map(([id, metric, window, limit]) => ({ id, provider: "groq", scopeAlias: "authored-organization", metric, window, resetTimezone: null, providerLimit: limit, appLimit: limit, verifiedAtUtc })) };
}
