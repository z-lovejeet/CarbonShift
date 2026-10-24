"use client";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import styles from "./landing.module.css";

const workflows = [
  { id: "simulate", label: "One activity", subtitle: "Understand its electricity use", number: "01", title: "Start with what your device uses.", description: "Explore electricity and estimated grid CO₂ for an activity at a time you choose. Adjust the details and keep the energy assumptions in view.", steps: ["Your device’s power or cycle energy", "Active duration and quantity", "A source-backed estimate for your chosen time"], link: "/app/simulate", action: "Explore an activity", note: "A useful first step when you want to understand a device before making a plan.", expression: ["Device energy", "Time", "Grid forecast"], outcome: "An estimate you can inspect" },
  { id: "tasks", label: "A few tasks", subtitle: "Find windows that work", number: "02", title: "Find a better window, on your terms.", description: "Compare the time you would normally use with feasible alternatives. Add individual windows, shared equipment, blocked periods and task order.", steps: ["An explicit usual time for every task", "Available windows and real constraints", "A reviewed baseline and feasible alternatives"], link: "/app/plan/new", action: "Plan your tasks", note: "If a longer window might help, compare it separately before changing your plan.", expression: ["Your usual times", "Your availability", "Feasible alternatives"], outcome: "A schedule you choose" },
  { id: "day", label: "My whole day", subtitle: "Bring the routine together", number: "03", title: "A whole routine, with room to move.", description: "Build one London calendar day around the activities you need to do. Keep fixed appointments and dependencies, then compare the complete timeline.", steps: ["Fixed tasks and flexible windows", "Equipment, attention and task dependencies", "Per-task results, reporting and corrections"], link: "/app/day/new", action: "Plan my day", note: "Report activities individually afterward. An incomplete day never becomes a complete savings claim.", expression: ["Your day", "Tasks in order", "One reviewed timeline"], outcome: "A routine kept together" },
] as const;

export function WorkflowPicker({ maximumTasks }: { maximumTasks: number }) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = workflows[selected]!;
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % workflows.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + workflows.length - 1) % workflows.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = workflows.length - 1;
    else return;
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  }
  return <div className={styles.workflowPicker}>
    <div className={styles.workflowTabs} role="tablist" aria-label="Choose your workspace">{workflows.map((workflow, index) => <button key={workflow.id} ref={(element) => { tabs.current[index] = element; }} id={`workspace-tab-${workflow.id}`} type="button" role="tab" aria-selected={index === selected} aria-controls={`workspace-panel-${workflow.id}`} tabIndex={index === selected ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => navigate(event, index)}><span className={styles.workflowNumber}>{workflow.number}</span><span><strong>{workflow.label}</strong><small>{workflow.subtitle}</small></span><span className={styles.tabArrow} aria-hidden="true">↗</span></button>)}</div>
    {workflows.map((workflow, index) => <div key={workflow.id} id={`workspace-panel-${workflow.id}`} aria-labelledby={`workspace-tab-${workflow.id}`} role="tabpanel" hidden={selected !== index} className={styles.workflowPanel} tabIndex={0}>{selected === index ? <><div className={styles.workflowContent}><h3>{active.title}</h3><p>{active.description}</p><ul>{active.steps.map((step) => <li key={step}>{step}</li>)}</ul><Link href={active.link} className={styles.quietLink}>{active.action} <span aria-hidden="true">↗</span></Link></div><div className={styles.workflowAside}><p className={styles.flowCaption}>How this workspace works</p><ol>{active.expression.map((part, partIndex) => <li key={part}><span>{String(partIndex + 1).padStart(2, "0")}</span>{part}</li>)}</ol><strong>{active.outcome}</strong><p className={styles.workflowNote}>{selected === 0 ? active.note : `Up to ${maximumTasks} activities. ${active.note}`}</p></div></> : null}</div>)}
  </div>;
}
