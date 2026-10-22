// Authored, test-only UI harness. No app route, provider request, or persistence.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TimingAssistant } from "../../components/planner/timing-assistant";
import { TaskForm } from "../../components/planner/task-form";
import { ExplanationPanel } from "../../components/planner/explanation-panel";
import { initialTaskDraft, type TaskDraft } from "../../lib/task-input";
import { AiFailure } from "../../lib/ai-api";
import type { ConstraintSuggestion } from "../../contracts/ai";
import { createComparison } from "../../domain/scheduling";
import { GB_UNIFORM_V1_FIXTURE as fixture } from "../../fixtures/demo/gb-uniform-v1";
let calls = 0;
export function callCount() { return calls; }
export function renderFixture(mode: "success" | "limited" | "unavailable" | "pending-explanation") {
  calls = 0;
  function Harness() {
    const [draft, setDraft] = useState<TaskDraft>(() => ({ ...initialTaskDraft("2026-10-22T06:00:00Z"), energyKwh: "0.875", earliest: { date: "2026-10-23", time: "08:00", offsetChoice: null } })), [reviewed, setReviewed] = useState(false);
    const suggestion: ConstraintSuggestion = { schemaVersion: 1, earliestLocal: { date: null, time: null, offsetChoice: null }, deadlineLocal: { date: "2026-10-23", time: "12:00", offsetChoice: null }, baselineLocal: { date: null, time: null, offsetChoice: null }, blockedLocal: [], durationMinutes: null, sourceSpans: [{ field: "deadlineLocal", start: 0, end: 23 }], questions: [{ field: "durationMinutes", code: "missing", messageKey: "complete_field" }], unsupportedRequests: [] };
    if (mode === "pending-explanation") {
      const comparison = createComparison({ constraints: fixture.constraints, snapshot: fixture.snapshot, forecastSnapshotId: fixture.snapshotReference.id, forecastSnapshotHash: fixture.snapshotReference.hash }, fixture.nowUtc);
      return <><ExplanationPanel comparison={{ ...comparison, schemaVersion: 1, id: "aa75c62e-5c5e-47fb-aa4a-8ac315f6868e", version: 1 }} request={() => new Promise(() => {})} /><button type="button">Review this plan</button></>;
    }
    return <><TimingAssistant available draft={draft} onApply={setDraft} referenceDate={() => "2026-10-22"} interpret={async () => { calls++; if (mode !== "success") throw new AiFailure(mode === "limited" ? "AI_RATE_LIMITED" : "AI_UNAVAILABLE", mode === "limited" ? 2 : null); return suggestion; }} />
      {reviewed ? <p role="status">Manual constraints ready for explicit confirmation.</p> : <TaskForm draft={draft} onChange={setDraft} nowUtc={() => "2026-10-22T06:00:00Z"} onReview={() => setReviewed(true)} />}</>;
  }
  createRoot(document.getElementById("ai-test-root")!).render(<Harness />);
}
