// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlannerFlow } from "@/components/planner/planner-flow";
import { PlanningFailure } from "@/lib/planning-api";
import { initialTaskDraft } from "@/lib/task-input";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { createComparison } from "@/domain/scheduling";
import { NOW, constraints, snapshot } from "../fixtures/domain";
vi.mock("@/components/planner/forecast-view", () => ({ ForecastView: () => <p>Validated forecast view</p> }));
const record = createGridSnapshotRecord(snapshot());
const comparison = createComparison({ constraints: constraints(), snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, NOW);
const id = "c51b4405-f40b-4e42-8ce3-0461312b8e05";
const view = { comparison: { ...comparison, schemaVersion: 1 as const, id, version: 1 as const }, forecastSnapshot: record.snapshot };
const plan = { schemaVersion: 1 as const, id, comparisonId: id, version: 1, mode: "live" as const, status: "accepted" as const, acceptedAtUtc: NOW, comparison, forecastSnapshot: record.snapshot, completion: "not_reported" as const, publication: "private" as const, latestReport: null, latestResult: null, reports: [], revisions: [] };
const draft = { ...initialTaskDraft(NOW), energyKwh: "1", earliest: { date: "2026-10-21", time: "08:00", offsetChoice: null }, deadline: { date: "2026-10-21", time: "12:00", offsetChoice: null } };
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "performance"] }); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function reachComparison(compare = vi.fn().mockResolvedValue(view), save = vi.fn(), onSaved = vi.fn()) {
  render(<PlannerFlow mode="live" nowUtc={NOW} initialDraft={draft} compare={compare} save={save} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: /Review constraints/ }));
  expect(screen.getByRole("button", { name: "Compare times" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm the duration/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compare times" })));
  return { compare, save, onSaved };
}
it("requires constraint review, retains fields on provider outage and offers an edit path", async () => {
  const compare = vi.fn().mockRejectedValue(new PlanningFailure("GRID_TIMEOUT", id));
  await reachComparison(compare);
  expect(screen.getByRole("alert")).toHaveTextContent("Your fields are preserved");
  fireEvent.click(screen.getByRole("button", { name: "Edit constraints" }));
  expect(screen.getByLabelText("Estimated cycle energy (kWh)")).toHaveValue("1");
  expect(document.getElementById("deadline-time")).toHaveValue("12:00");
});
it("does not save without a separate exact-result review and retries an interrupted save with the same key after expiry", async () => {
  const save = vi.fn().mockRejectedValueOnce(new PlanningFailure("NETWORK_UNAVAILABLE")).mockResolvedValue(plan), onSaved = vi.fn();
  await reachComparison(undefined, save, onSaved);
  fireEvent.click(screen.getByRole("button", { name: "Review this plan" }));
  expect(screen.getByRole("button", { name: "Save this plan" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save this plan" })));
  await act(async () => { vi.advanceTimersByTime(301_000); });
  const retry = screen.getByRole("button", { name: "Retry the same save" });expect(retry).toBeEnabled();
  await act(async () => fireEvent.click(retry));
  expect(save).toHaveBeenCalledTimes(2);expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);expect(save.mock.calls[0]?.slice(0, 2)).toEqual([id, 1]);
  expect(onSaved).toHaveBeenCalledWith(plan);
});
it("expired unsaved comparisons require another review and cannot be accepted", async () => {
  await reachComparison();
  await act(async () => { vi.advanceTimersByTime(301_000); });
  expect(screen.getByRole("button", { name: "Review this plan" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Compare again" }));
  expect(screen.getByRole("checkbox", { name: /I confirm the duration/ })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Compare times" })).toBeDisabled();
});
it("keeps the demo labeled and produces only a local preview", async () => {
  render(<PlannerFlow mode="demo" nowUtc={NOW} initialDraft={draft} compare={async () => view} />);
  fireEvent.click(screen.getByRole("button", { name: /Review constraints/ }));fireEvent.click(screen.getByRole("checkbox", { name: /I confirm the duration/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compare times" })));
  fireEvent.click(screen.getByRole("button", { name: "Review this plan" }));fireEvent.click(screen.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }));
  fireEvent.click(screen.getByRole("button", { name: "Preview example plan" }));
  expect(screen.getByText(/Nothing was saved or published/)).toBeVisible();expect(screen.getByText("Illustrative example", { exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Reset example" }));expect(screen.getByLabelText("Estimated cycle energy (kWh)")).toHaveValue("1");
});
it("refuses a valid-looking save response for a different reviewed comparison", async () => {
  const onSaved = vi.fn(), save = vi.fn().mockResolvedValue({ ...plan, comparisonId: "967bd7f7-669f-4829-b710-54c840d91018" });
  await reachComparison(undefined, save, onSaved);fireEvent.click(screen.getByRole("button", { name: "Review this plan" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I’ve reviewed the exact baseline/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save this plan" })));
  expect(onSaved).not.toHaveBeenCalled();expect(screen.getByRole("alert")).toBeVisible();
});

it("uses server-referenced UI time rather than an incorrect device wall clock", async () => {
  vi.setSystemTime(new Date("2026-10-23T06:00:00Z"));
  await reachComparison();
  expect(screen.getByRole("button", { name: "Review this plan" })).toBeEnabled();
});
