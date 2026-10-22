import { describe, expect, it } from "vitest";
import { suggestionShape } from "@/contracts/ai";
import { validateSuggestion, explanationFacts, validateExplanation, templateSelection, explanationSentences } from "@/server/ai/validation";
import { suggestionFixture } from "../fixtures/ai";
import { comparison } from "../fixtures/domain";
import development from "@/fixtures/ai/development-v1.json";
import holdout from "@/fixtures/ai/holdout-v1.json";
const text = "Tomorrow finish by noon. ";
describe("M06 semantic validation and grounded templates", () => {
  it("rejects invented fields, energy and malformed date/time", () => {
    expect(suggestionShape.safeParse({ ...suggestionFixture(), energyWh: 9000 }).success).toBe(false);
    const v = suggestionFixture(); v.deadlineLocal.date = "2026-02-30"; expect(suggestionShape.safeParse(v).success).toBe(false);
    v.deadlineLocal.time = "24:30"; expect(suggestionShape.safeParse(v).success).toBe(false);
  });
  it.each([{ start: 0, end: 999 }, { start: 8, end: 3 }, { start: 24, end: 25 }])("rejects invalid/empty source spans", (span) => {
    const v = suggestionFixture(); v.sourceSpans = [{ field: "deadlineLocal", ...span }]; expect(() => validateSuggestion(v, text)).toThrow();
  });
  it("rejects unsupported populated fields without text support and split UTF-16 pairs", () => {
    const v = suggestionFixture(); v.sourceSpans = []; expect(() => validateSuggestion(v, text)).toThrow();
    v.sourceSpans = [{ field: "deadlineLocal", start: 1, end: 8 }]; expect(() => validateSuggestion(v, "😀 tomorrow by noon")).toThrow();
  });
  it("adds required missing-field and clock-change clarifications deterministically", () => {
    const v = suggestionFixture(); v.questions = []; v.deadlineLocal = { date: "2026-10-25", time: "01:30", offsetChoice: null };
    const result = validateSuggestion(v, text); expect(result.questions).toEqual(expect.arrayContaining([expect.objectContaining({ field: "deadlineLocal", code: "ambiguous" }), expect.objectContaining({ field: "earliestLocal", code: "missing" })]));
    v.deadlineLocal = { date: "2027-03-28", time: "01:30", offsetChoice: null }; expect(validateSuggestion(v, text).questions).toContainEqual(expect.objectContaining({ field: "deadlineLocal", code: "invalid_time" }));
  });
  it("grounds every selected code and always includes required limitations", () => {
    const c = { ...comparison(), schemaVersion: 1 as const, id: "11c78a67-c3c8-4f5d-8985-328637f913e8", version: 1 as const }, facts = explanationFacts(c);
    const valid = templateSelection(facts); expect(validateExplanation(valid, facts)).toEqual(valid);
    expect(() => validateExplanation({ ...valid, reasonCodes: ["BASELINE_ALREADY_BEST"] }, facts)).toThrow();
    expect(() => validateExplanation({ ...valid, limitationCodes: ["NATIONAL_SIGNAL"] }, facts)).toThrow();
    expect(explanationSentences(valid, c).join(" ")).toContain("200 g CO₂");
    expect(explanationSentences(valid, c).join(" ")).not.toContain("saved");
    const zero = { ...c, differenceMg: 0 }; expect(templateSelection(explanationFacts(zero)).reasonCodes).toContain("BASELINE_ALREADY_BEST");
  });
  it("keeps 20/40 authored datasets separated and review status honest", () => {
    expect(development.cases).toHaveLength(20); expect(holdout.cases).toHaveLength(40);
    expect(holdout.humanReviewed).toBe(false);
    const families = new Set(development.cases.map((c) => c.family)); expect(holdout.cases.some((c) => families.has(c.family))).toBe(false);
    expect(new Set([...development.cases, ...holdout.cases].map((c) => c.id)).size).toBe(60);
  });
});
