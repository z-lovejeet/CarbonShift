import { describe, expect, it } from "vitest";
import { validateActivitySuggestion } from "@/server/ai/activity-variant";
import { candidates } from "@/config/ai-policy";
import { policyFixture } from "../fixtures/ai-policy";
import { inputFingerprint } from "@/server/ai/identity";
const task = { category: "television", durationMinutes: 60, quantity: 1, energyText: null, earliestLocal: null, deadlineLocal: null, baselineLocal: null, fixed: null, requiresAttention: null, predecessorIndices: [], sourceStart: 0, sourceEnd: 10, questions: [] };
const validate = (text: string, fields = {}) => validateActivitySuggestion({ schemaVersion: 2, tasks: [{ ...task, sourceEnd: text.length, ...fields }] }, text).tasks[0]!;
describe("household AI review boundary", () => {
  it("does not let v1 qualification enable the new variant", () => { const policy = policyFixture(); expect(candidates(policy, "constraints")).toHaveLength(1); expect(candidates(policy, "constraints", false, "activity-v2")).toHaveLength(0); policy.models[0]!.qualifiedVariants = ["activity-v2"]; expect(candidates(policy, "constraints", false, "activity-v2")).toHaveLength(1); });
  it("rejects invented power and unsupported source spans", () => { expect(() => validate("Watch TV", { energyText: "200 W" })).toThrow(); expect(() => validate("Watch TV", { sourceStart: 10 })).toThrow(); });
  it("asks for missing energy and equipment without inventing car consumption", () => { expect(validate("Clean my car", { category: "car_cleaning", durationMinutes: null }).questions).toEqual(expect.arrayContaining(["energy", "duration", "equipment"])); });
  it("clears ambiguous London times for explicit review", () => { expect(validate("Use computer at 01:30 on 25 October", { baselineLocal: "2026-10-25T01:30" })).toMatchObject({ baselineLocal: null, questions: expect.arrayContaining(["timing"]) }); });
  it("retains explicit energy and rejects invalid dependency indices", () => { expect(validate("TV 100 W", { energyText: "100 W" }).energyText).toBe("100 W"); expect(() => validate("TV", { predecessorIndices: [0] })).toThrow(); });
  it("separates v1 and v2 request identities", () => { const hmac = "h".repeat(64), input = { text: "Watch TV" }; expect(inputFingerprint(hmac, "constraints", input)).not.toBe(inputFingerprint(hmac, "constraints", input, undefined, "activity-v2")); });
});
