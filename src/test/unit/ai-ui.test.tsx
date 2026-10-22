// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TimingAssistant } from "@/components/planner/timing-assistant";
import { ExplanationPanel } from "@/components/planner/explanation-panel";
import { AiFailure } from "@/lib/ai-api";
import { initialTaskDraft } from "@/lib/task-input";
import { applyTimingSuggestion } from "@/lib/ai-draft";
import { suggestionFixture } from "../fixtures/ai";
import { comparison } from "../fixtures/domain";
const text = "Tomorrow finish by noon. ";
const draft = { ...initialTaskDraft("2026-10-22T12:00:00Z"), energyKwh: "0.875" };
afterEach(() => { cleanup(); vi.useRealTimers(); });
function setup(interpret = vi.fn().mockResolvedValue(suggestionFixture()), onApply = vi.fn()) {
  render(<TimingAssistant available draft={draft} onApply={onApply} referenceDate={() => "2026-10-22"} interpret={interpret} />);
  fireEvent.click(screen.getByText("Describe your timing"));
  fireEvent.change(screen.getByLabelText("Your timing request"), { target: { value: text } });
  return { interpret, onApply };
}
it("requires consent and explicit review before populating fields", async () => {
  const f = setup(); expect(screen.getByRole("button", { name: "Suggest timing fields" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I agree to send/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Suggest timing fields" })));
  expect(f.interpret).toHaveBeenCalledOnce(); expect(f.onApply).not.toHaveBeenCalled(); expect(screen.getByText("Supporting text")).toBeVisible();
  const apply = screen.getByRole("button", { name: "Apply checked suggestions" }); expect(apply).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I checked these suggestions/ })); fireEvent.click(apply);
  expect(f.onApply).toHaveBeenCalledOnce(); expect(f.onApply.mock.calls[0]![0]).toMatchObject({ energyKwh: "0.875", deadline: { date: "2026-10-23", time: "12:00" } });
  expect(screen.getByText(/Suggestions added/)).toBeVisible();
});
it("prevents duplicate clicks, retains raw text on failure and honors actual retry time", async () => {
  vi.useFakeTimers(); const interpret = vi.fn().mockRejectedValue(new AiFailure("AI_RATE_LIMITED", 3)); setup(interpret);
  fireEvent.click(screen.getByRole("checkbox", { name: /I agree to send/ }));
  const submit = screen.getByRole("button", { name: "Suggest timing fields" });
  await act(async () => { fireEvent.click(submit); fireEvent.click(submit); });
  expect(interpret).toHaveBeenCalledOnce(); expect(screen.getByLabelText("Your timing request")).toHaveValue(text);
  expect(screen.getByRole("button", { name: "Start a new AI request" })).toBeDisabled();
  await act(async () => vi.advanceTimersByTime(3000)); expect(screen.getByRole("button", { name: "Start a new AI request" })).toBeEnabled();
});
it("never applies unsupported appliance/automation requests", async () => {
  const suggestion = suggestionFixture(); suggestion.unsupportedRequests = ["automatic_control"];
  setup(vi.fn().mockResolvedValue(suggestion)); fireEvent.click(screen.getByRole("checkbox", { name: /I agree to send/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Suggest timing fields" })));
  expect(screen.getByText(/outside the supported manual/)).toBeVisible(); expect(screen.queryByRole("button", { name: "Apply checked suggestions" })).toBeNull();
});
it("renders a truthful disabled state with no text transmission control", () => {
  render(<TimingAssistant available={false} draft={draft} onApply={vi.fn()} referenceDate={() => "2026-10-22"} interpret={vi.fn()} />);
  fireEvent.click(screen.getByText("Describe your timing")); expect(screen.getByText(/Timing assistance is currently unavailable/)).toBeVisible(); expect(screen.queryByRole("textbox")).toBeNull();
});
it("retains manually entered fields when a suggestion is missing and never adds energy", () => {
  const v = suggestionFixture(); const before = { ...draft, earliest: { date: "2026-10-24", time: "10:00", offsetChoice: "later" as const } };
  const after = applyTimingSuggestion(before, v); expect(after.energyKwh).toBe(before.energyKwh); expect(after.earliest.time).toBe("10:00"); expect(after.earliest.date).toBe("2026-10-24"); expect(after.earliest.offsetChoice).toBe("later");
  v.earliestLocal = { date: "2026-10-25", time: "01:30", offsetChoice: null }; expect(applyTimingSuggestion(before, v).earliest.offsetChoice).toBeNull();
});
it("never withholds the deterministic comparison during an explanation outage", async () => {
  const c = { ...comparison(), id: "899edc57-9bfc-4581-9d1b-b7d2a3285661", schemaVersion: 1 as const, version: 1 as const };
  const request = vi.fn().mockRejectedValue(new AiFailure("AI_UNAVAILABLE")); render(<ExplanationPanel comparison={c} request={request} />);
  expect(screen.getByText(/lower forecast estimate than your reviewed baseline/)).toBeVisible();
  fireEvent.click(screen.getByText("Ask AI to select the key reasons")); fireEvent.click(screen.getByRole("checkbox"));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Explain this comparison" })));
  expect(screen.getByText(/comparison and reasons above remain usable/)).toBeVisible(); expect(screen.getByText(/lower forecast estimate than your reviewed baseline/)).toBeVisible();
});
