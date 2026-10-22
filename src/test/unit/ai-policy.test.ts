import { describe, expect, it } from "vitest";
import { aiPolicySchema, candidates, disabledAiPolicy, parseAiPolicy } from "@/config/ai-policy";
import { parseWebEnvironment } from "@/config/environment";
import { policyFixture } from "../fixtures/ai-policy";
import { windowBounds, providerBudgets, tokenReservation } from "@/server/limits/budgets";
describe("M06 strict policy and calendar quota boundaries", () => {
  it("accepts only verified/qualified entries for web use", () => {
    const p = policyFixture(); expect(candidates(parseAiPolicy(JSON.stringify(p)), "constraints")).toHaveLength(1);
    p.models[0]!.qualifiedRoles = []; expect(candidates(p, "constraints")).toEqual([]); expect(candidates(p, "constraints", true)).toHaveLength(1);
    expect(candidates(disabledAiPolicy, "constraints", true)).toEqual([]);
  });
  it.each(["url", "extra"])("rejects arbitrary policy fields: %s", (field) => {
    expect(aiPolicySchema.safeParse({ ...policyFixture(), [field]: "https://untrusted.test" }).success).toBe(false);
  });
  it("rejects invented aliases and model/bucket provider mismatch", () => {
    const p = policyFixture(); expect(aiPolicySchema.safeParse({ ...p, roles: { ...p.roles, constraints: ["gemini-3.7-flash"] } }).success).toBe(false);
    p.buckets[0]!.provider = "gemini"; expect(aiPolicySchema.safeParse(p).success).toBe(false);
  });
  it("rejects missing references, duplicate IDs and unverifiable limits", () => {
    const p = policyFixture(); p.models[0]!.bucketIds.push("missing"); expect(aiPolicySchema.safeParse(p).success).toBe(false);
    const q = policyFixture(); q.buckets.push(q.buckets[0]!); expect(aiPolicySchema.safeParse(q).success).toBe(false);
    const r = policyFixture(); r.buckets[0]!.verifiedAtUtc = null; expect(aiPolicySchema.safeParse(r).success).toBe(false);
  });
  it("rejects impossible limits, invalid reset zones and incomplete quotas", () => {
    const p = policyFixture(); p.buckets[0]!.appLimit = 31; expect(aiPolicySchema.safeParse(p).success).toBe(false);
    p.buckets[0]!.window = "calendar_day"; p.buckets[0]!.resetTimezone = "Nowhere/City"; expect(aiPolicySchema.safeParse(p).success).toBe(false);
    const q = policyFixture(); q.models[0]!.bucketIds = ["rpm", "rpd"]; expect(aiPolicySchema.safeParse(q).success).toBe(false);
    expect(() => parseAiPolicy(" ".repeat(16385))).toThrow();
  });
  it("allows disabled startup without a policy or secret disclosure", () => {
    expect(parseWebEnvironment({ AI_ENABLED: "false", AI_POLICY_JSON: "not ready", GEMINI_API_KEY: "authored-canary" }).ai).toEqual({ enabled: false });
  });
  it("uses Pacific midnight and its 23/25-hour DST days", () => {
    const spring = windowBounds("2026-03-08T08:00:00Z", "calendar_day", "America/Los_Angeles");
    const autumn = windowBounds("2026-11-01T07:00:00Z", "calendar_day", "America/Los_Angeles");
    expect(spring.expiresAt).toBe("2026-03-09T07:00:00Z"); expect(autumn.expiresAt).toBe("2026-11-02T08:00:00Z");
    expect((Date.parse(spring.expiresAt) - Date.parse("2026-03-08T08:00:00Z")) / 3600000).toBe(23);
    expect((Date.parse(autumn.expiresAt) - Date.parse("2026-11-01T07:00:00Z")) / 3600000).toBe(25);
  });
  it("keeps shared provider buckets identical across role and policy changes", () => {
    const p = policyFixture(), m = p.models[0]!, now = "2026-10-22T12:00:00Z";
    const a = providerBudgets(p, m, tokenReservation("text", "{}", 2048), now);
    p.profile = "eligible_free_development"; m.qualifiedRoles = [];
    expect(providerBudgets(p, m, tokenReservation("text", "{}", 2048), now)).toEqual(a);
    expect(a[0]!.limit).toBe(200);
  });
});
