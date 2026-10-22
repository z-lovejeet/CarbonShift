import type { Plan } from "@/contracts/planning";
import type { ResultRevision } from "@/contracts/lifecycle";
import { grams, londonLabel } from "@/lib/presentation";
const statuses: Record<ResultRevision["result"]["status"], string> = { forecast_only: "Forecast only", actual_pending: "Waiting for actual grid data", actual_estimate: "Updated grid estimate", did_not_run: "Reported not run", outside_supported_window: "Report kept without an updated calculation" };
const reasons: Record<string, string> = { PROFILE_CHANGED: "The original duration or energy assumption no longer applies.", REPORT_TOO_LATE: "The run started more than 24 hours after the saved deadline.", ACTUAL_SNAPSHOT_UNAVAILABLE: "Actual grid data are unavailable. You can check again later.", MISSING_ACTUAL_FACTORS: "Actual readings do not yet cover both complete cycles. No missing value is treated as zero." };
const deviations: Record<string, string> = { DIFFERENT_START: "Started at a different time", BEFORE_EARLIEST: "Started before your original window", AFTER_DEADLINE: "Finished after your original deadline", BLOCKED_PERIOD: "Overlapped an originally blocked period" };
export function UpdatedEstimate({ revision }: { revision: ResultRevision }) {
  const result = revision.result;
  return <div className="updated-estimate"><p className="eyebrow">{statuses[result.status]}</p>
    {result.status === "actual_estimate" ? <><dl className="review-list"><div><dt>Original baseline with actual grid factors</dt><dd>{grams(result.baselineActualMg!)} g CO₂</dd></div><div><dt>Reported run with actual grid factors</dt><dd>{grams(result.reportedActualMg!)} g CO₂</dd></div><div><dt>{result.differenceMg! < 0 ? "Higher updated estimate" : result.differenceMg === 0 ? "No estimated difference" : "Lower updated estimate"}</dt><dd>{result.differenceMg! > 0 ? "+" : ""}{grams(result.differenceMg!)} g CO₂{result.differencePercent === null ? " · percentage unavailable (zero baseline)" : ` · ${result.differencePercent.toFixed(1)}%`}</dd></div></dl><p className="field-hint">Difference = baseline minus reported run. This estimates grid-associated CO₂ using assumed cycle energy and self-reported timing. It does not measure avoided emissions.</p></> : result.status === "did_not_run" ? <p>No updated emissions comparison or avoided-emissions claim is made for non-execution.</p> : result.reasonCodes.map((code) => <p key={code}>{reasons[code]}</p>)}
    {result.deviationCodes.length ? <ul className="muted">{result.deviationCodes.map((code) => <li key={code}>{deviations[code]}</li>)}</ul> : null}
    <p className="field-hint">Result revision {revision.sequence} · {londonLabel(revision.createdAtUtc)} · {result.methodVersion}</p>
  </div>;
}
export function ResultHistory({ plan }: { plan: Plan }) {
  if (!plan.latestReport || !plan.latestResult) return <section className="completion-summary"><p className="eyebrow">Execution unreported</p><h2>Your forecast is saved.</h2><p>After the wash, report what happened to compare the actual national grid factors with your frozen baseline.</p></section>;
  return <section className="completion-summary" aria-labelledby="execution-heading"><p className="eyebrow">Self-reported · energy assumed · private</p><h2 id="execution-heading">{plan.status === "cancelled" ? "Plan cancelled" : plan.latestReport.kind === "ran" ? "You reported a completed wash" : "You reported non-execution"}</h2>
    {plan.latestReport.reportedStartUtc ? <p>Reported start · {londonLabel(plan.latestReport.reportedStartUtc)}</p> : null}
    <UpdatedEstimate revision={plan.latestResult} />
    <details className="source-details"><summary>Report and result history ({plan.revisions.length})</summary><ol className="revision-list">{[...plan.revisions].reverse().map((revision) => {
      const report = plan.reports.find((item) => item.id === revision.reportId)!;
      return <li key={revision.id}><h3>Result {revision.sequence} · {revision.reason === "refresh" ? "Grid data refreshed" : revision.reason === "correction" ? "Report corrected" : revision.reason === "cancelled" ? "Cancelled before start" : "Execution reported"}</h3><p>Report {report.sequence} · {report.kind === "ran" ? `Ran at ${londonLabel(report.reportedStartUtc!)}` : "Did not run"} · {londonLabel(report.createdAtUtc)}</p>{report.kind === "ran" ? <p>Original profile still applies: {report.profileStillApplicable ? "Yes" : "No"}</p> : null}{report.reason ? <p>{report.source === "cancellation" ? "Cancelled before the selected start." : report.reason}</p> : null}{report.note ? <p>{report.note}</p> : null}<UpdatedEstimate revision={revision} /></li>;
    })}</ol></details>
  </section>;
}
