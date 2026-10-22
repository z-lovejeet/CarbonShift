import type { ComparisonRequest } from "@/contracts/planning";
import { kwh, londonLabel } from "@/lib/presentation";

export function ConstraintReview({ input }: { input: ComparisonRequest }) {
  return <dl className="review-list">
    <div><dt>Appliance & signal</dt><dd>One washing cycle · Great Britain national estimate</dd></div>
    <div><dt>Duration & energy</dt><dd>{input.durationMinutes} minutes · {kwh(input.energyWh)} kWh ({input.energyWh} Wh), {input.energyBasis === "user_estimate" ? "your estimate" : "illustrative assumption"}</dd></div>
    <div><dt>Earliest start</dt><dd>{londonLabel(input.earliestStartUtc)}</dd></div><div><dt>Finish by</dt><dd>{londonLabel(input.deadlineUtc)}</dd></div>
    <div><dt>Your baseline</dt><dd>{input.baseline.kind === "user_selected" ? londonLabel(input.baseline.startUtc) : "Earliest feasible start — the exact time will be shown in the comparison."}</dd></div>
    <div><dt>Blocked periods</dt><dd>{input.blockedIntervals.length ? <ul>{input.blockedIntervals.map((block) => <li key={block.startUtc}>{londonLabel(block.startUtc)} → {londonLabel(block.endUtc)}</li>)}</ul> : "None"}</dd></div>
  </dl>;
}
