"use client";
import { useState } from "react";
import { GB_UNIFORM_V1_FIXTURE as fixture } from "@/fixtures/demo/gb-uniform-v1";
import { createComparison } from "@/domain/scheduling";
import { feasibleStarts, normalizeConstraints } from "@/domain/constraints";
import { londonTime } from "@/domain/time";
import { DomainError } from "@/domain/errors";
import { comparisonViewSchema, type ComparisonRequest } from "@/contracts/planning";
import { initialTaskDraft } from "@/lib/task-input";
import { PlanningFailure } from "@/lib/planning-api";
import { PlannerFlow } from "@/components/planner/planner-flow";

export function DemoPlanner() {
  const local = (utc: string) => { const value = londonTime(utc); return { date: value.date, time: value.time, offsetChoice: null }; };
  const [draft] = useState(() => ({ ...initialTaskDraft(fixture.nowUtc), energyKwh: String(fixture.constraints.energyWh / 1000), energyBasis: "illustrative_default" as const,
    earliest: local(fixture.constraints.earliestStartUtc), deadline: local(fixture.constraints.deadlineUtc) }));
  async function compare(input: ComparisonRequest) {
    try {
      const { baseline, constraintsConfirmed: _confirmed, ...fields } = input;void _confirmed;
      let constraints = normalizeConstraints({ ...fields, baselineStartUtc: baseline.kind === "user_selected" ? baseline.startUtc : input.earliestStartUtc, baselineOrigin: baseline.kind === "user_selected" ? "user_selected" : "earliest_feasible_confirmed", confirmedAtUtc: fixture.nowUtc });
      if (baseline.kind === "earliest_feasible") constraints = normalizeConstraints({ ...constraints, baselineStartUtc: feasibleStarts(constraints, fixture.nowUtc)[0] });
      const result = createComparison({ constraints, snapshot: fixture.snapshot, forecastSnapshotId: fixture.snapshotReference.id, forecastSnapshotHash: fixture.snapshotReference.hash }, fixture.nowUtc);
      return comparisonViewSchema.parse({ comparison: { ...result, id: fixture.snapshotReference.id, version: 1, schemaVersion: 1 }, forecastSnapshot: fixture.snapshot });
    } catch (error) { throw new PlanningFailure(error instanceof DomainError ? error.code : "INVALID_INPUT"); }
  }
  return <PlannerFlow mode="demo" nowUtc={fixture.nowUtc} initialDraft={draft} compare={compare} />;
}
