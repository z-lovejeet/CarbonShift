// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppShell } from "../../components/layout/app-shell";
import ErrorPage from "../../app/error";
import { navigationCurrent } from "../../components/layout/primary-navigation";

afterEach(cleanup);

it("marks only the current workspace and tolerates an unavailable router", () => {
  expect(navigationCurrent("/app", null)).toBe(false);
  expect(navigationCurrent("/app", "/app/plans/accepted-plan")).toBe(true);
  expect(navigationCurrent("/app", "/app/simulate")).toBe(false);
  expect(navigationCurrent("/app/day/new", "/app/day/new")).toBe(true);
});

it("provides the navigation, main target and keyboard skip link", () => {
  render(<AppShell><h1>Example content</h1></AppShell>);
  expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main-content");
  expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Example content");
});

it("offers a working retry and a safe return path without rendering error internals", () => {
  const reset = vi.fn();
  render(<ErrorPage reset={reset} />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
});
