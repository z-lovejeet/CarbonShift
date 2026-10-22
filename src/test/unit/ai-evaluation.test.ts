import { describe, expect, it } from "vitest";
import { evaluationConfiguration, evaluationDatasetSchema, percentile, scoreSuggestion } from "@/server/ai/evaluation";
import { policyFixture } from "../fixtures/ai-policy";
import { suggestionFixture } from "../fixtures/ai";
import { validateExplanation, templateSelection, type ExplanationFacts } from "@/server/ai/validation";
import { reasonCodes, limitationCodes } from "@/contracts/ai";
import development from "@/fixtures/ai/development-v1.json";
import explanation from "@/fixtures/ai/explanation-v1.json";
const subsets = <T>(xs: readonly T[]): T[][] => Array.from({ length: 2 ** xs.length }, (_, mask) => xs.filter((_, i) => (mask & (1 << i)) !== 0));
describe("M06 evaluation guards, metrics and exhaustive explanation grounding", () => {
  it("permits an unpromoted candidate only for explicit evaluation with complete budgets", () => {
    const p = policyFixture(); p.models[0]!.qualifiedRoles = [];
    const env = { AI_ENABLED: "false", AI_POLICY_JSON: JSON.stringify(p), RATE_LIMIT_HMAC_SECRET: "authored-hmac-secret-with-32-characters", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", SUPABASE_SECRET_KEY: "authored-secret", GROQ_API_KEY: "authored-key" };
    expect(evaluationConfiguration(env, "openai/gpt-oss-120b", "constraints").policy.models[0]!.qualifiedRoles).toEqual([]);
    p.buckets[0]!.verifiedAtUtc = null; expect(() => evaluationConfiguration({ ...env, AI_POLICY_JSON: JSON.stringify(p) }, "openai/gpt-oss-120b", "constraints")).toThrow("Values are omitted");
  });
  it("counts failed output as incorrect, correct nulls, missing clarifications and unsupported actions", () => {
    const c = evaluationDatasetSchema.parse(development).cases[0]!;
    expect(scoreSuggestion(c, null).correctFields).toBe(0); const v = suggestionFixture(); expect(scoreSuggestion(c, v).criticalCorrect).toBe(true);
    v.deadlineLocal.time = "13:00"; expect(scoreSuggestion(c, v).wrongFields).toContain("deadlineLocal.time"); expect(scoreSuggestion(c, v).criticalCorrect).toBe(false);
    expect(percentile([2, 1, 4, 3], .5)).toBe(2); expect(percentile([], .95)).toBeNull();
  });
  it("penalizes invented scalars, blocks and false unsupported classifications", () => {
    const c = evaluationDatasetSchema.parse(development).cases[0]!, v = suggestionFixture(); v.baselineLocal.time = "09:00"; v.unsupportedRequests = ["other"];
    const result = scoreSuggestion(c, v); expect(result.criticalCorrect).toBe(false); expect(result.wrongFields).toContain("baselineLocal.time"); expect(result.extraUnsupported).toEqual(["other"]);
    v.unsupportedRequests = []; v.baselineLocal.time = null; v.blockedLocal = [{ startDate: "2026-10-23", startTime: "10:00", endDate: "2026-10-23", endTime: "11:00" }];
    expect(scoreSuggestion(c, v).wrongFields).toContain("blockedLocal.0.startTime");
  });
  it("checks every eligible/ineligible code subset against every fact combination", () => {
    let combinations = 0;
    for (const c of explanation.cases) {
      const { id: _id, ...rawFacts } = c; void _id; const facts = rawFacts as ExplanationFacts;
      expect(() => validateExplanation(templateSelection(facts), facts)).not.toThrow();
      for (const reasons of subsets(reasonCodes)) for (const limits of subsets(limitationCodes)) {
        const permitted = reasons.length <= 3 && limits.length >= 1 && limits.length <= 3 && reasons.every((r) => facts.eligibleReasonCodes.includes(r)) && limits.every((l) => facts.eligibleLimitationCodes.includes(l)) && facts.requiredLimitationCodes.every((l) => limits.includes(l));
        const validate = () => validateExplanation({ schemaVersion: 1, reasonCodes: reasons, limitationCodes: limits }, facts);
        if (permitted) expect(validate).not.toThrow(); else expect(validate).toThrow(); combinations++;
      }
    }
    expect(combinations).toBe(1024);
  });
});
