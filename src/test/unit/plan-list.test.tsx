// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlanList } from "@/components/plans/plan-list";
import { planningApi, PlanningFailure } from "@/lib/planning-api";
import { comparison, NOW } from "../fixtures/domain";
const id = "c51b4405-f40b-4e42-8ce3-0461312b8e05", nextId = "967bd7f7-669f-4829-b710-54c840d91018";
const fixture = comparison();
const item = { schemaVersion: 1 as const, id, comparisonId: id, version: 1, mode: "live" as const, status: "accepted" as const, acceptedAtUtc: NOW, completion: "not_reported" as const, publication: "private" as const, baseline: fixture.baseline, selected: fixture.selected, differenceMg: fixture.differenceMg };
afterEach(cleanup);
it("empty state offers a real planner route without inventing user totals", () => {
  render(<PlanList initial={{ items: [], nextCursor: null }} />);
  expect(screen.getByRole("link", { name: "Plan a wash" })).toHaveAttribute("href", "/app/plan/new");expect(screen.queryByText(/g CO₂/)).not.toBeInTheDocument();
});
it("keeps existing plans after a page failure and safely resumes pagination without duplicating rows", async () => {
  vi.spyOn(planningApi, "page").mockRejectedValueOnce(new PlanningFailure("NETWORK_UNAVAILABLE")).mockResolvedValue({ items: [item, { ...item, id: nextId }], nextCursor: null });
  render(<PlanList initial={{ items: [item], nextCursor: "cursor" }} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Load more plans" })));
  expect(screen.getByRole("alert")).toBeVisible();expect(document.querySelectorAll(`a[href="/app/plans/${id}"]`)).toHaveLength(1);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Load more plans" })));
  expect(document.querySelectorAll(`a[href="/app/plans/${id}"]`)).toHaveLength(1);expect(document.querySelector(`a[href="/app/plans/${nextId}"]`)).toBeVisible();
});
