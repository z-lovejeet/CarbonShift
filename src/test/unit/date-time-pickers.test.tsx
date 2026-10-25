// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateTimeField } from "@/components/planner/date-time-field";
import type { LocalTimeInput } from "@/lib/task-input";

afterEach(() => { cleanup(); vi.useRealTimers(); });
function Field({ initial }: { initial: LocalTimeInput }) {
  const [value, setValue] = useState(initial);
  return <><DateTimeField id="example" label="Usual start" value={value} onChange={setValue} minDate="2026-10-25" maxDate="2026-10-27" /><output data-testid="value">{JSON.stringify(value)}</output></>;
}
function currentValue() { return JSON.parse(screen.getByTestId("value").textContent!) as LocalTimeInput; }

it("defaults a new empty date to the London day without inventing a time", () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-25T22:00:00Z"));
  render(<Field initial={{ date: "", time: "", offsetChoice: null }} />);
  expect(screen.getByLabelText("Date")).toHaveValue("25/10/2026");
  expect(currentValue()).toEqual({ date: "2026-10-25", time: "", offsetChoice: null });
});

it("preserves an existing chosen date and exact minute values", () => {
  render(<Field initial={{ date: "2026-10-27", time: "23:04", offsetChoice: null }} />);
  expect(screen.getByLabelText("Date")).toHaveValue("27/10/2026");
  expect(screen.getByLabelText("Time")).toHaveValue("23:04");
  expect(screen.getByLabelText("Date")).toHaveAttribute("type", "text");
  expect(screen.getByLabelText("Time")).toHaveAttribute("type", "text");
});

it("accepts typed ISO or UK dates while keeping the domain value in ISO format", () => {
  render(<Field initial={{ date: "2026-10-25", time: "12:00", offsetChoice: null }} />);
  const input = screen.getByLabelText("Date");
  fireEvent.focus(input); fireEvent.change(input, { target: { value: "2026-10-26" } }); fireEvent.blur(input);
  expect(input).toHaveValue("26/10/2026"); expect(currentValue().date).toBe("2026-10-26");
  fireEvent.focus(input); fireEvent.change(input, { target: { value: "27/10/2026" } }); fireEvent.blur(input);
  expect(currentValue().date).toBe("2026-10-27");
});

it("does not reuse the previous valid time after an invalid edit", () => {
  render(<Field initial={{ date: "2026-10-25", time: "12:00", offsetChoice: null }} />);
  const input = screen.getByLabelText("Time");
  fireEvent.focus(input); fireEvent.change(input, { target: { value: "25:90" } });
  expect(currentValue().time).toBe("");
});

it("keeps DST occurrence review and clears the old occurrence when time changes", () => {
  render(<Field initial={{ date: "2026-10-25", time: "01:30", offsetChoice: "earlier" }} />);
  expect(screen.getByLabelText("Which occurrence?")).toHaveValue("earlier");
  fireEvent.change(screen.getByLabelText("Time"), { target: { value: "02:04" } });
  expect(currentValue()).toEqual({ date: "2026-10-25", time: "02:04", offsetChoice: null });
  expect(screen.queryByLabelText("Which occurrence?")).not.toBeInTheDocument();
});
