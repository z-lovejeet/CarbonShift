// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ForecastView } from "@/components/planner/forecast-view";
import { createComparison } from "@/domain/scheduling";
import { createGridSnapshotRecord } from "@/server/grid/snapshot";
import { constraints, snapshot, NOW } from "../fixtures/domain";
vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(cleanup);
function example(factors?: number[]) {
  const record = createGridSnapshotRecord(snapshot(factors));
  return { record, comparison: createComparison({ constraints: constraints(), snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, NOW) };
}
it("renders domain estimates, original factors, baseline bands and explicit assumptions", () => {
  const { record, comparison } = example();render(<ForecastView comparison={comparison} snapshot={record.snapshot} />);
  expect(screen.getByText(/200 g lower forecast estimate/)).toBeVisible();expect(screen.getByText(/not measured avoided emissions/)).toBeVisible();
  fireEvent.click(screen.getByText(/View accessible forecast table/));expect(screen.getByRole("table")).toBeVisible();
  expect(screen.getByRole("cell", { name: "100" })).toBeVisible();expect(screen.getByText("Not supplied by the provider")).toBeVisible();
});
it("zero baseline never renders a percentage or invents improvement", () => {
  const { record, comparison } = example(Array(8).fill(0));render(<ForecastView comparison={comparison} snapshot={record.snapshot} />);
  expect(screen.getByText("No estimated improvement over your baseline.")).toBeVisible();expect(document.body.textContent).not.toContain("% lower");
});
