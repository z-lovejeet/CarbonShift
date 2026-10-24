// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CompletionForm } from "@/components/plans/completion-form";
import { ResultHistory } from "@/components/plans/result-history";
import { AccountControls } from "@/components/auth/account-controls";
import { planSchema } from "@/contracts/planning";
import { createComparison } from "@/domain/scheduling";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { createLifecycleService } from "@/server/plans/lifecycle";
import { NOW, constraints, snapshot } from "../fixtures/domain";
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const id = "8d46189a-7ef2-46f2-a674-aea5b026d06e", record = createGridSnapshotRecord(snapshot());
const comparison = createComparison({ constraints: constraints(), snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, NOW);
const plan = planSchema.parse({ schemaVersion: 1, id, comparisonId: id, version: 1, mode: "live", status: "accepted", acceptedAtUtc: NOW, comparison, forecastSnapshot: record.snapshot, completion: "not_reported", publication: "private", latestReport: null, latestResult: null, reports: [], revisions: [] });
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => { fetcher.mockReset(); vi.stubGlobal("fetch", fetcher); });
afterEach(cleanup);
it("T09 completion UI preserves edits and retry identity after uncertain failure", async () => {
  fetcher.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ data: { planId: id, planVersion: 2, reportId: id, resultId: id, changed: true, deleted: false }, requestId: id }));
  render(<CompletionForm plan={plan} />);
  fireEvent.change(screen.getByLabelText("Do the saved duration and energy assumption still apply?"), { target: { value: "no" } });
  fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "A different wash cycle" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save execution report" })));
  expect(screen.getByRole("alert")).toBeVisible(); expect(screen.getByLabelText("Note (optional)")).toHaveValue("A different wash cycle");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save execution report" })));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]![1]?.headers).toEqual(fetcher.mock.calls[1]![1]?.headers);
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({ kind: "ran", profileStillApplicable: false, reportedStartUtc: comparison.selected.startUtc });
  expect(router.replace).toHaveBeenCalledWith(`/app/plans/${id}`);
});
it("T09 non-execution submits null timing/profile and no fictional savings", async () => {
  fetcher.mockResolvedValue(Response.json({ data: { planId: id, planVersion: 2, reportId: id, resultId: id, changed: true, deleted: false }, requestId: id }));
  render(<CompletionForm plan={plan} />); fireEvent.click(screen.getByLabelText("I did not run it"));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save execution report" })));
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ kind: "did_not_run", reportedStartUtc: null, profileStillApplicable: null, correctsReportId: null, reason: "" });
});
it("T08/T09 result UI shows a signed higher estimate with its assumptions", async () => {
  const commit = vi.fn().mockResolvedValue({ planId: id, planVersion: 2, reportId: id, resultId: id, changed: true, deleted: false });
  const data = snapshot([100, 100, 200, 200, 500, 500, 300, 300]); data.retrievedAtUtc = "2026-10-21T12:00:00Z";
  await createLifecycleService({ repository: { detail: async () => plan, replay: async () => null, commit }, now: () => "2026-10-21T12:00:00Z", actual: async () => createGridSnapshotRecord(data) }).report(id, { kind: "ran", reportedStartUtc: comparison.selected.startUtc, profileStillApplicable: true, correctsReportId: null, reason: "" }, "report-key", "a".repeat(64));
  const written = commit.mock.calls[0]![0];
  render(<ResultHistory plan={{ ...plan, latestReport: written.report, latestResult: written.revision, reports: [written.report], revisions: [written.revision] }} />);
  expect(screen.getAllByText("Higher updated estimate")[0]).toBeVisible(); expect(screen.getAllByText(/-400 g CO₂/)[0]).toBeVisible(); expect(screen.getByText("Your history · self-reported · energy assumed")).toBeVisible();
});
it("T02 account deletion stays disabled until both recent confirmation and acknowledgement exist", () => {
  const view = render(<AccountControls reauthenticated={false} />);
  fireEvent.click(screen.getByRole("checkbox")); expect(screen.getByRole("button", { name: "Delete my CarbonShift account" })).toBeDisabled();
  view.rerender(<AccountControls reauthenticated />); expect(screen.getByRole("button", { name: "Delete my CarbonShift account" })).toBeEnabled();
});
