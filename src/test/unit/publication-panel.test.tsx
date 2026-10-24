// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublicationPanel } from "@/components/plans/publication-panel";
import { proofBundle } from "../fixtures/proof/bundle";
import { hashPlan } from "@/domain/proof";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);
const id = "e4789abd-5abc-4f65-8be3-1df045314c77", bundle = proofBundle(), digest = hashPlan(bundle.plan);
const preview = { id, manifest: bundle.plan, manifestHash: digest, expiresAtUtc: "2026-10-21T06:05:00Z", consentVersion: "public-proof-v1" };
const response = (data: unknown) => Response.json({ data, requestId: id });
it("keeps a private plan useful with publication unavailable and has no fake success state", () => {
  render(<PublicationPanel planId={id} latestRevision={null} cancelled={false} available={false} initial={{ publication: null }} />);
  expect(screen.queryByRole("button", { name: "Review publication" })).toBeNull(); expect(screen.getByText(/New publication is currently unavailable/)).toBeTruthy();
});
it("requires an unchecked exact-data consent and preserves retry keys after network uncertainty", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(preview)).mockRejectedValueOnce(new Error("lost ack")).mockResolvedValueOnce(response({ operationId: id, receiptId: bundle.plan.receiptId, manifestHash: digest })).mockResolvedValueOnce(response({ publication: null })); vi.stubGlobal("fetch", fetcher);
  render(<PublicationPanel planId={id} latestRevision={null} cancelled={false} available initial={{ publication: null }} />);
  fireEvent.click(screen.getByRole("button", { name: "Review publication" }));
  const checkbox = await screen.findByRole("checkbox"); expect((checkbox as HTMLInputElement).checked).toBe(false);
  const publish = screen.getByRole("button", { name: "Publish this exact copy" }) as HTMLButtonElement; expect(publish.disabled).toBe(true);
  fireEvent.click(checkbox); fireEvent.click(publish); await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Publish this exact copy" })); await screen.findByRole("status");
  const calls = fetcher.mock.calls.filter(([url]) => String(url).endsWith("/publication"));
  expect(calls[0]![1]?.headers).toEqual(calls[1]![1]?.headers); expect(JSON.parse(String(calls[0]![1]?.body))).toMatchObject({ manifestHash: digest, consent: true });
});
it("shows real uncertainty and never auto-publishes a newer private result", () => {
  const operation = { id, kind: "plan" as const, status: "uncertain" as const, manifestHash: digest, transactionHash: digest, blockNumber: null, checkedAtUtc: null, failureCode: "NOT_FOUND" };
  render(<PublicationPanel planId={id} latestRevision={3} cancelled={false} available initial={{ publication: { receiptId: bundle.plan.receiptId, manifestHash: digest, manifest: bundle.plan, operation, results: [] } }} />);
  expect(screen.getByText(/Unpublished changes/)).toBeTruthy(); expect(screen.getByText(/transaction could not be confirmed/)).toBeTruthy(); expect(screen.queryByRole("button", { name: "Review result publication" })).toBeNull();
});
