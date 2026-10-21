import { describe, expect, it, vi } from "vitest";
import { feasibleStarts, normalizeConstraints } from "@/domain/constraints";
import { assertAcceptanceTime, ceilHalfHour, comparisonExpiry, londonTime, overlaps, precommitCutoff, resolveLondonTime } from "@/domain/time";
import { constraints, NOW } from "../fixtures/domain";

describe("M02.02 time and feasibility (T03/T06)", () => {
  it.each([["2026-01-12", "12:00", "2026-01-12T12:00:00Z"], ["2026-07-12", "12:00", "2026-07-12T11:00:00Z"], ["2026-07-12", "00:30", "2026-07-11T23:30:00Z"]])("resolves London %s %s independently of machine timezone", (date, time, expected) => {
    vi.stubEnv("TZ", "Asia/Kolkata");
    expect(resolveLondonTime({ date, time })).toBe(expected);
    expect(londonTime(expected)).toMatchObject({ date, time, timezone: "Europe/London" });
  });
  it("requires an offset for the repeated hour and preserves both instants", () => {
    const local = { date: "2026-10-25", time: "01:30" };
    expect(() => resolveLondonTime(local)).toThrow(expect.objectContaining({ code: "AMBIGUOUS_LOCAL_TIME" }));
    const earlier = resolveLondonTime({ ...local, offsetChoice: "earlier" }), later = resolveLondonTime({ ...local, offsetChoice: "later" });
    expect(earlier).toBe("2026-10-25T00:30:00Z");
    expect(later).toBe("2026-10-25T01:30:00Z");
    expect(londonTime(earlier).offset).toBe("+01:00");
    expect(londonTime(later).offset).toBe("+00:00");
  });
  it.each([null, "earlier", "later"])("rejects the nonexistent spring time even with choice %s", (offsetChoice) => {
    expect(() => resolveLondonTime({ date: "2026-03-29", time: "01:30", offsetChoice })).toThrow(expect.objectContaining({ code: "NONEXISTENT_LOCAL_TIME" }));
  });
  it.each([{ date: "2026-02-30", time: "12:00" }, { date: "2026-07-12", time: "25:00" }, { date: "2026-07-12", time: "10:30:00" }])("rejects invalid local input %j", (input) => {
    expect(() => resolveLondonTime(input)).toThrow(expect.objectContaining({ code: "INVALID_LOCAL_TIME" }));
  });
  it("counts 50 autumn and 46 spring half-hours without assuming 24-hour local days", () => {
    for (const [date, nextDate, count] of [["2026-10-25", "2026-10-26", 50], ["2026-03-29", "2026-03-30", 46]] as const) {
      const start = resolveLondonTime({ date, time: "00:00" }), end = resolveLondonTime({ date: nextDate, time: "00:00" });
      expect((Date.parse(end) - Date.parse(start)) / 1800000).toBe(count);
    }
  });
  it("rounds earliest forward, permits exact deadline, and rejects one minute over", () => {
    expect(ceilHalfHour("2026-10-21T07:00:00Z")).toBe("2026-10-21T07:00:00Z");
    expect(ceilHalfHour("2026-10-21T07:00:01Z")).toBe("2026-10-21T07:30:00Z");
    const input = { ...constraints(), deadlineUtc: "2026-10-21T08:00:00Z" };
    expect(feasibleStarts(input, NOW)).toEqual([input.earliestStartUtc]);
    expect(() => feasibleStarts({ ...input, deadlineUtc: "2026-10-21T07:59:00Z" }, NOW)).toThrow(expect.objectContaining({ code: "NO_FEASIBLE_CANDIDATE" }));
    expect(feasibleStarts(constraints(), "2026-10-21T07:20:01Z")[0]).toBe("2026-10-21T08:00:00Z");
  });
  it("uses half-open blocking without relaxing a constraint", () => {
    expect(overlaps("2026-10-21T07:00:00Z", "2026-10-21T08:00:00Z", "2026-10-21T08:00:00Z", "2026-10-21T09:00:00Z")).toBe(false);
    const starts = feasibleStarts({ ...constraints(), blockedIntervals: [{ startUtc: "2026-10-21T08:00:00Z", endUtc: "2026-10-21T09:00:00Z" }] }, NOW);
    expect(starts).toEqual(["2026-10-21T07:00:00Z", "2026-10-21T09:00:00Z", "2026-10-21T09:30:00Z", "2026-10-21T10:00:00Z"]);
  });
  it("normalizes blocks on a copy and rejects future confirmation", () => {
    const first = { startUtc: "2026-10-21T08:00:00Z", endUtc: "2026-10-21T08:30:00Z" }, last = { startUtc: "2026-10-21T10:00:00Z", endUtc: "2026-10-21T10:30:00Z" };
    const input = { ...constraints(), blockedIntervals: [last, first] };
    const normalized = normalizeConstraints(input);
    expect(normalized.blockedIntervals).toEqual([first, last]);
    expect(input.blockedIntervals).toEqual([last, first]);
    expect(Object.isFrozen(normalized.blockedIntervals[0])).toBe(true);
    expect(() => feasibleStarts({ ...constraints(), confirmedAtUtc: "2026-10-21T06:00:01Z" }, NOW)).toThrow(expect.objectContaining({ code: "INVALID_TIME_WINDOW" }));
  });
  it("enforces 48 elapsed hours through the fall-back transition", () => {
    const input = { ...constraints(), earliestStartUtc: "2026-10-24T12:00:00Z", deadlineUtc: "2026-10-26T12:00:00Z", baselineStartUtc: "2026-10-24T12:30:00Z", confirmedAtUtc: "2026-10-24T12:00:00Z" };
    expect(feasibleStarts(input, input.confirmedAtUtc).at(-1)).toBe("2026-10-26T11:00:00Z");
    expect(() => feasibleStarts({ ...input, deadlineUtc: "2026-10-26T12:00:01Z" }, input.confirmedAtUtc)).toThrow(expect.objectContaining({ code: "OUTSIDE_PLANNING_HORIZON" }));
  });
  it("handles UTC midnight rollover", () => {
    const input = { ...constraints(), earliestStartUtc: "2026-10-21T23:31:00Z", deadlineUtc: "2026-10-22T01:00:00Z" };
    expect(feasibleStarts(input, NOW)).toEqual(["2026-10-22T00:00:00Z"]);
  });
  it("bounds review expiry by both lifetime and the earlier start", () => {
    expect(comparisonExpiry(NOW, "2026-10-21T07:00:00Z", "2026-10-21T09:00:00Z")).toBe("2026-10-21T06:05:00Z");
    expect(comparisonExpiry("2026-10-21T06:18:00Z", "2026-10-21T07:00:00Z", "2026-10-21T06:30:00Z")).toBe("2026-10-21T06:20:00Z");
    expect(precommitCutoff("2026-10-21T07:00:00Z", "2026-10-21T06:30:00Z")).toBe("2026-10-21T06:30:00Z");
    expect(() => comparisonExpiry("2026-10-21T06:20:00Z", "2026-10-21T07:00:00Z", "2026-10-21T06:30:00Z")).toThrow(expect.objectContaining({ code: "COMPARISON_EXPIRED" }));
    const comparison = { createdAtUtc: NOW, expiresAtUtc: "2026-10-21T06:05:00Z", baselineStartUtc: "2026-10-21T07:00:00Z", selectedStartUtc: "2026-10-21T09:00:00Z" };
    expect(() => assertAcceptanceTime(comparison, "2026-10-21T06:04:59Z")).not.toThrow();
    expect(() => assertAcceptanceTime(comparison, comparison.expiresAtUtc)).toThrow(expect.objectContaining({ code: "COMPARISON_EXPIRED" }));
  });
});
