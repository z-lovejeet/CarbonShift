"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { activityInputSchema, type ReferenceProfileV2, type ScheduleInputV2 } from "@/domain/activities/schemas";
import { scheduleComparisonSchema, scheduleDocumentSchema, type ScheduleComparison } from "@/contracts/schedules";
import { activityRequest, ActivityApiError } from "@/lib/activity-api";
import { DomainError } from "@/domain/errors";
import { normalizeSchedule, planningBounds } from "@/domain/activities/constraints";
import { activityKwh, draftFromSuggestion } from "@/lib/activity-input";
import { compileSchedule, emptyScheduleTask, localInput, activityToDraft, HANDOFF_KEY, type ScheduleTaskDraft } from "@/lib/schedule-input";
import { londonTime, addSeconds } from "@/domain/time";
import { resolveActivity } from "@/domain/activities/energy";
import { londonLabel } from "@/lib/presentation";
import { ActivityAssistant } from "./activity-assistant";
import { ScheduleTaskEditor } from "./schedule-task-editor";
import { ScheduleComparisonView } from "./schedule-comparison";
const handoffSchema = z.strictObject({ schemaVersion: z.literal(2), ownerTag: z.string().length(64), activity: activityInputSchema, startUtc: z.string(), expiresAt: z.number() });
export function TaskPlanner({ profiles, nowUtc, aiAvailable, kind = "tasks", handoff = false, ownerTag }: { ownerTag: string; profiles: ReferenceProfileV2[]; nowUtc: string; aiAvailable: boolean; kind?: "tasks" | "day"; handoff?: boolean }) {
  const router = useRouter(), date = londonTime(nowUtc).date;
  const [clockOrigin] = useState(() => performance.now());
  const currentTime = () => addSeconds(nowUtc, Math.max(0, Math.floor((performance.now() - clockOrigin) / 1000)));
  const bounds = planningBounds(nowUtc);
  const [fieldErrors, setFieldErrors] = useState<readonly { path: string; message: string }[]>([]);
  const [day, setDay] = useState(date), [tasks, setTasks] = useState<ScheduleTaskDraft[]>(() => [emptyScheduleTask(date, "task-1")]), [active, setActive] = useState(0);
  const [review, setReview] = useState<ScheduleInputV2 | null>(null), [confirmed, setConfirmed] = useState(false), [comparison, setComparison] = useState<ScheduleComparison | null>(null);
  const [choice, setChoice] = useState(0), [saveConfirmed, setSaveConfirmed] = useState(false), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [relaxation, setRelaxation] = useState<ScheduleComparison | null>(null);
  const sequence = useRef(0), pending = useRef<AbortController | null>(null), key = useRef<string | null>(null);
  useEffect(() => { const seq = sequence; return () => { seq.current++; pending.current?.abort(); }; }, []);
  function reset() { sequence.current++; pending.current?.abort(); setReview(null); setConfirmed(false); setComparison(null); setRelaxation(null); setSaveConfirmed(false); setError(null); setFieldErrors([]); setBusy(false); key.current = null; }
  useEffect(() => {
    const issue = fieldErrors[0];
    if (!issue || review) return;
    const match = issue.path.match(/^tasks\.([^.]+)\.(?:windows\.(\d+)\.(startUtc|endUtc)|(baselineStartUtc))$/);
    if (!match) return;
    const id = match[4] ? `${match[1]}-baseline` : `${match[1]}-window-${match[2]}-${match[3] === "startUtc" ? "start" : "end"}`;
    document.getElementById(`${id}-date`)?.focus();
  }, [fieldErrors, review]);
  function showFailure(value: unknown) {
    const issues = value instanceof DomainError || value instanceof ActivityApiError ? value.fieldErrors : [];
    setFieldErrors(issues);
    if (issues.length) {
      const i = tasks.findIndex((t) => issues[0]!.path.startsWith(`tasks.${t.activity.id}.`));
      if (i >= 0) setActive(i);
      setReview(null); setConfirmed(false);
    }
    setError(value instanceof z.ZodError ? "Check each task’s duration, available windows and equipment names. Window ends must follow their starts." : value instanceof Error ? value.message : "Review your task fields.");
  }
  function reviewTasks() {
    try {
      const compiled = compileSchedule(tasks, profiles, kind, day);
      setReview(normalizeSchedule(compiled, profiles, currentTime()).input);
      setError(null); setFieldErrors([]); setConfirmed(false);
    } catch (e) { showFailure(e); }
  }
  function update(task: ScheduleTaskDraft) { reset(); setTasks(tasks.map((t, i) => i === active ? task : t)); }
  function loadHandoff() {
    try { const value = handoffSchema.parse(JSON.parse(sessionStorage.getItem(HANDOFF_KEY) ?? "null")); if (value.ownerTag !== ownerTag || value.expiresAt < Date.now()) throw new Error();
      const draft = emptyScheduleTask(londonTime(value.startUtc).date, value.activity.id); draft.activity = activityToDraft(value.activity); draft.baseline = localInput(value.startUtc); draft.windows[0]!.start = localInput(value.startUtc);
      reset(); setTasks([draft]); setActive(0); sessionStorage.removeItem(HANDOFF_KEY);
    } catch { setError("The simulator handoff expired or could not be read. Enter the activity below."); }
  }
  async function compare(input: ScheduleInputV2, expanded = false) {
    try { normalizeSchedule(input, profiles, currentTime()); } catch (e) { if (expanded) setError(e instanceof Error ? e.message : "This extension does not fit the planning limits."); else showFailure(e); return; }
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller; const current = ++sequence.current; setBusy(true); setError(null);
    try { const answer = await activityRequest("/schedules/compare", scheduleComparisonSchema, { input, constraintsConfirmed: true }, { signal: controller.signal });
      if (current === sequence.current) { if (expanded) setRelaxation(answer); else { setComparison(answer); setChoice(0); setSaveConfirmed(false); key.current = null; } }
    } catch (e) { if (current === sequence.current) { if (expanded) setError(e instanceof Error ? e.message : "The extension could not be compared. Your original comparison is unchanged."); else showFailure(e); } }
    finally { if (current === sequence.current) setBusy(false); }
  }
  async function save() {
    if (!comparison || !saveConfirmed) return; setBusy(true); setError(null); key.current ??= crypto.randomUUID();
    try { const saved = await activityRequest("/schedules", scheduleDocumentSchema, { comparisonId: comparison.id, version: 1, optionIndex: choice, confirmed: true }, { idempotencyKey: key.current }); sessionStorage.removeItem(HANDOFF_KEY); router.push(`/app/plans/${saved.id}`); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save could not be confirmed. Retry with the same inputs."); setBusy(false); }
  }
  function proposeWiderWindow() {
    if (!comparison) return; const input = structuredClone(comparison.input);
    for (const task of input.tasks) if (!task.fixedStartUtc) task.windows = task.windows.map((w) => ({ ...w, endUtc: addSeconds(w.endUtc, 1800) }));
    void compare(input, true);
  }
  function applyProposal() {
    if (!relaxation) return;
    const next = tasks.map((task) => { const proposed = relaxation.input.tasks.find((t) => t.activity.id === task.activity.id)!; return { ...task, windows: proposed.windows.map((w) => ({ start: localInput(w.startUtc), end: localInput(w.endUtc) })) }; }); reset(); setTasks(next);
  }
  return <div className="household-planner"><aside className="notice planning-range" aria-label="Planning time limits"><p>Planning limits when this page opened: <strong>{londonLabel(bounds.earliestWindowUtc)}</strong> to <strong>{londonLabel(bounds.latestEndUtc)}</strong>. Task starts need at least ten minutes for review. Forecast coverage and the current time are checked again when you compare or save.</p>{kind === "day" ? <p>Every window must stay within the selected London day. <Link href="/app/plan/new">Use Plan tasks for an overnight window</Link>.</p> : <p>Windows may cross midnight within these limits. All dates and times use Europe/London.</p>}</aside>{error ? <p role="alert" className="notice error-notice">{error}</p> : null}{comparison ? <><ScheduleComparisonView comparison={comparison} optionIndex={choice} />{comparison.solution.alternatives.length ? <fieldset className="option-picker"><legend>Choose a feasible schedule</legend>{[comparison.solution.selected, ...comparison.solution.alternatives].map((option, i) => <label className="check-label" key={i}><input type="radio" name="schedule-choice" checked={choice === i} disabled={busy} onChange={() => { setChoice(i); setSaveConfirmed(false); key.current = null; }} /><span>{i === 0 ? "Recommended" : `Alternative ${i}`} · {(option.estimatedMg / 1000).toLocaleString("en-GB", { maximumFractionDigits: 3 })} g CO₂ · {option.tasks.map((t) => londonLabel(t.startUtc)).join(" / ")}</span></label>)}</fieldset> : null}<div className="save-review"><h3>Keep this plan</h3><p>The complete reviewed schedule and this forecast will be saved privately. Review before {londonLabel(comparison.expiresAtUtc)}; after that, compare again.</p><label className="check-label"><input type="checkbox" checked={saveConfirmed} disabled={busy} onChange={(e) => setSaveConfirmed(e.target.checked)} /><span>I have reviewed every task, its usual time, selected time and energy assumptions. Save this exact schedule.</span></label><div className="action-row"><button className="button" disabled={busy || !saveConfirmed} onClick={() => void save()}>{busy ? "Working…" : "Save schedule"}</button><button className="button secondary" disabled={busy} onClick={() => { reset(); }}>Edit tasks</button></div></div>{kind === "tasks" && comparison.input.tasks.some((t) => !t.fixedStartUtc) ? <details className="source-details"><summary>Could a longer window help?</summary><p>Ask for a separate comparison with 30 minutes added to each flexible window’s end. Your usual times, energy, blocks and task order stay the same. This proposal uses one fresh forecast for both its baseline and extended options. Compare its own numbers; the source may have changed since your earlier comparison. It cannot be saved until you apply and review the changed windows.</p><button className="button secondary" disabled={busy} onClick={proposeWiderWindow}>Compare a 30-minute extension</button>{relaxation ? <div className="window-proposal"><ScheduleComparisonView comparison={relaxation} /><button className="button secondary" onClick={applyProposal}>Apply these windows and review again</button></div> : null}</details> : null}</> : review ? <section className="constraint-review"><p className="eyebrow">Review before comparing</p><h2>{review.tasks.length} {review.tasks.length === 1 ? "task" : "tasks"}, on your terms.</h2>{review.tasks.map((task) => { const activity = resolveActivity(task.activity, profiles); return <div className="task-review-row" key={task.activity.id}><h3>{task.activity.name}</h3><p>{task.activity.durationMinutes} minutes · {activityKwh(activity.energyMwh)} kWh · {task.fixedStartUtc ? "Fixed start" : "Flexible within your windows"}</p><p>Usual start: {londonLabel(task.baselineStartUtc)}</p><p>Available: {task.windows.map((w) => `${londonLabel(w.startUtc)} → ${londonLabel(w.endUtc)}`).join("; ")}</p>{task.blocks.length ? <p>Blocked: {task.blocks.map((w) => `${londonLabel(w.startUtc)} → ${londonLabel(w.endUtc)}`).join("; ")}</p> : null}<p>{task.requiresAttention ? "Needs your attention throughout." : "No continuous-attention constraint selected."} {task.resourceIds.length ? `Shared: ${task.resourceIds.join(", ")}.` : ""} {task.predecessorIds.length ? `Starts after: ${task.predecessorIds.map((id) => review.tasks.find((t) => t.activity.id === id)!.activity.name).join(", ")}.` : ""}</p></div>; })}<label className="check-label"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(e) => setConfirmed(e.target.checked)} /><span>These are my usual times and available windows. I have checked each energy assumption, task order and safe operating conditions.</span></label><div className="action-row"><button className="button" disabled={!confirmed || busy} onClick={() => void compare(review)}>{busy ? "Comparing the full schedule…" : "Compare schedules"}</button><button className="button secondary" disabled={busy} onClick={reset}>Back to editing</button></div></section> : <>{handoff ? <div className="notice"><p>Bring the reviewed activity across from the simulator, then choose its available windows.</p><button className="text-button" onClick={loadHandoff}>Load simulator activity</button></div> : null}{kind === "day" ? <div className="day-picker task-form"><label htmlFor="planning-day">Your day · Europe/London</label><input type="date" id="planning-day" min={londonTime(bounds.earliestWindowUtc).date} max={londonTime(bounds.latestEndUtc).date} value={day} onChange={(e) => { reset(); const nextDay = e.target.value; setDay(nextDay); const shift = (value: typeof tasks[number]["baseline"]) => ({ ...value, date: nextDay, offsetChoice: null }); setTasks(tasks.map((task) => ({ ...task, baseline: shift(task.baseline), windows: task.windows.map((w) => ({ start: shift(w.start), end: shift(w.end) })), blocks: task.blocks.map((b) => ({ start: shift(b.start), end: shift(b.end) })) }))); }} /><p className="field-hint">Every task and window must fit this London calendar day and the available 48-hour forecast.</p></div> : null}{aiAvailable ? <ActivityAssistant multiple onApply={(suggestion) => { reset(); const next = suggestion.tasks.map((suggested, i) => { const t = emptyScheduleTask(day, `task-${i + 1}`); t.activity = draftFromSuggestion(suggested, t.activity.id); for (const [field, local] of [["baseline", suggested.baselineLocal], ["start", suggested.earliestLocal], ["end", suggested.deadlineLocal]] as const) if (local) { const value = { date: local.slice(0, 10), time: local.slice(11), offsetChoice: null }; if (field === "baseline") t.baseline = value; else t.windows[0]![field] = value; } t.fixed = suggested.fixed === true; t.attention = suggested.requiresAttention === true; t.predecessorIds = suggested.predecessorIndices.map((n) => `task-${n + 1}`); return t; }); setTasks(next); setActive(0); }} /> : null}<div className="task-planner-layout"><aside className="task-index"><p className="eyebrow">Your activities · {tasks.length}/12</p><ol>{tasks.map((task, i) => <li key={task.activity.id}><button type="button" className={active === i ? "active" : ""} aria-current={active === i ? "step" : undefined} onClick={() => setActive(i)}><span>{String(i + 1).padStart(2, "0")}</span><strong>{task.activity.name || "New activity"}</strong><small>{task.activity.duration ? `${task.activity.duration} min` : "Add details"}{task.fixed ? " · Fixed" : ""}</small></button></li>)}</ol>{tasks.length < 12 ? <button className="text-button" onClick={() => { reset(); const id = `task-${crypto.randomUUID().slice(0, 8)}`; setTasks([...tasks, emptyScheduleTask(day, id)]); setActive(tasks.length); }}>Add another activity</button> : null}<p className="field-hint">Each activity gets its own available windows. Shared equipment and attention prevent overlaps.</p></aside><section className="task-detail"><div className="task-editor-heading"><h2>Activity {active + 1}</h2><div className="task-draft-actions">{active > 0 ? <button className="text-button" onClick={() => { reset(); const next = [...tasks]; [next[active - 1], next[active]] = [next[active]!, next[active - 1]!]; setTasks(next); setActive(active - 1); }}>Move earlier in list</button> : null}{active < tasks.length - 1 ? <button className="text-button" onClick={() => { reset(); const next = [...tasks]; [next[active + 1], next[active]] = [next[active]!, next[active + 1]!]; setTasks(next); setActive(active + 1); }}>Move later in list</button> : null}{tasks.length < 12 ? <button className="text-button" onClick={() => { reset(); const copy = structuredClone(tasks[active]!); copy.activity.id = `task-${crypto.randomUUID().slice(0, 8)}`; copy.activity.confirmed = false; copy.baseline.time = ""; copy.fixed = false; setTasks([...tasks, copy]); setActive(tasks.length); }}>Duplicate activity</button> : null}</div>{tasks.length > 1 ? <button className="text-button" onClick={() => { reset(); const removed = tasks[active]!.activity.id; setTasks(tasks.filter((_, i) => i !== active).map((t) => ({ ...t, predecessorIds: t.predecessorIds.filter((id) => id !== removed) }))); setActive(Math.max(0, active - 1)); }}>Remove activity</button> : null}</div><ScheduleTaskEditor task={tasks[active]!} tasks={tasks} profiles={profiles} onChange={update} minDate={londonTime(bounds.earliestWindowUtc).date} maxDate={londonTime(bounds.latestEndUtc).date} dayDate={kind === "day" ? day : undefined} errors={Object.fromEntries(fieldErrors.filter((e) => e.path.startsWith(`tasks.${tasks[active]!.activity.id}.`)).map((e) => [e.path.slice(`tasks.${tasks[active]!.activity.id}.`.length), e.message]))} /><button className="button" onClick={reviewTasks}>Review all tasks</button></section></div></>}</div>;
}
