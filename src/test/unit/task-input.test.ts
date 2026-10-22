import { expect, it } from "vitest";
import { buildTaskInput, initialTaskDraft, type TaskDraft } from "@/lib/task-input";
import { NOW } from "../fixtures/domain";
const draft = (): TaskDraft => ({ ...initialTaskDraft(NOW), energyKwh: "0.875", earliest: { date: "2026-10-21", time: "08:00", offsetChoice: null }, deadline: { date: "2026-10-21", time: "12:00", offsetChoice: null } });
it("converts explicit London entry and decimal kWh without sending clock/owner/totals", () => {
  const result = buildTaskInput(draft(), NOW);
  expect(result.data).toMatchObject({ energyWh: 875, earliestStartUtc: "2026-10-21T07:00:00Z", deadlineUtc: "2026-10-21T11:00:00Z", baseline: { kind: "earliest_feasible" } });
  expect(result.data).not.toHaveProperty("confirmedAtUtc");
  expect(result.data).not.toHaveProperty("differenceMg");
});
it.each(["1.0001", "0.049", "5.001", "1e0", "NaN", "", "1,5"])("rejects invalid energy text %s", (energyKwh) => expect(buildTaskInput({ ...draft(), energyKwh }, NOW).errors).toHaveProperty("energy"));
it("requires an explicit repeated-hour occurrence and preserves its exact UTC mapping", () => {
  const task = { ...draft(), earliest: { date: "2026-10-25", time: "01:30", offsetChoice: null }, deadline: { date: "2026-10-25", time: "04:00", offsetChoice: null } };
  const now = "2026-10-24T20:00:00Z";
  expect(buildTaskInput(task, now).errors).toHaveProperty("earliest");
  expect(buildTaskInput({ ...task, earliest: { ...task.earliest, offsetChoice: "earlier" } }, now).data?.earliestStartUtc).toBe("2026-10-25T00:30:00Z");
  expect(buildTaskInput({ ...task, earliest: { ...task.earliest, offsetChoice: "later" } }, now).data?.earliestStartUtc).toBe("2026-10-25T01:30:00Z");
});
it("rejects nonexistent spring time even with an offset choice", () => {
  const task = { ...draft(), earliest: { date: "2027-03-28", time: "01:30", offsetChoice: "later" as const } };
  expect(buildTaskInput(task, "2027-03-27T20:00:00Z").errors?.earliest).toContain("does not exist");
});
it("rejects overlapping/outside blocks, infeasible cycles, late deadlines and invalid baselines", () => {
  const task = draft();
  const local = (time: string) => ({ date: "2026-10-21", time, offsetChoice: null });
  expect(buildTaskInput({ ...task, blocks: [{ start: local("09:00"), end: local("10:00") }, { start: local("09:30"), end: local("10:30") }] }, NOW).errors?.window).toContain("overlap");
  expect(buildTaskInput({ ...task, blocks: [{ start: local("07:00"), end: local("09:00") }] }, NOW).errors?.window).toContain("within");
  expect(buildTaskInput({ ...task, deadline: local("08:30") }, NOW).errors?.window).toContain("No complete cycle");
  expect(buildTaskInput({ ...task, deadline: { ...local("12:00"), date: "2026-10-24" } }, NOW).errors?.window).toContain("48-hour");
  expect(buildTaskInput({ ...task, baselineKind: "user_selected", baseline: local("08:15") }, NOW).errors).toHaveProperty("baseline");
});
it("does not mutate the draft while normalizing blocks", () => {
  const task = draft(), copy = structuredClone(task);buildTaskInput(task, NOW);expect(task).toEqual(copy);
});
