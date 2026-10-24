import { expect, it, vi } from "vitest";
import { createPublicationHandler } from "@/server/publication/handlers";
import { ApiError } from "@/server/http/errors";
import { proofBundle } from "../fixtures/proof/bundle";
import type { PublicationPreview, PublicationState } from "@/contracts/publication";
const id = "e4789abd-5abc-4f65-8be3-1df045314c77", origin = "http://127.0.0.1:3000";
const manifestHash = "0x" + "1".repeat(64);
function harness() {
  const service = { preview: vi.fn(async (): Promise<PublicationPreview> => ({ id, manifest: proofBundle().plan, manifestHash, expiresAtUtc: "2026-10-21T06:05:00Z", consentVersion: "public-proof-v1" })), consent: vi.fn(async () => ({ operationId: id, receiptId: manifestHash, manifestHash })), state: vi.fn(async (): Promise<PublicationState> => ({ publication: null })), bundle: vi.fn(async () => proofBundle()) };
  const repository = { identity: vi.fn(), preview: vi.fn(), reviewedPreview: vi.fn(), consent: vi.fn(), actualSnapshot: vi.fn(), state: vi.fn(), operation: vi.fn(async () => { throw new ApiError("NOT_FOUND", 404, "Not found."); }) };
  const authenticate = vi.fn(async () => ({ userId: id, service, repository })), ingress = vi.fn(async () => {});
  return { service, repository, authenticate, ingress, handle: createPublicationHandler({ origin: () => origin, authenticate, ingress }) };
}
function request(body: unknown, headers: Record<string, string> = {}) { return new Request(`${origin}/api/v1/plans/${id}/publication`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "Idempotency-Key": "real-retry-key", ...headers }, body: JSON.stringify(body) }); }
const consent = { previewId: id, manifestHash, consentVersion: "public-proof-v1", consent: true };
it("checks same-origin before identity/elevation and requires server authentication", async () => {
  const h = harness(); expect((await h.handle(request(consent, { Origin: "https://foreign.invalid" }), id, "consent")).status).toBe(403); expect(h.authenticate).not.toHaveBeenCalled();
  h.authenticate.mockRejectedValueOnce(new ApiError("UNAUTHENTICATED", 401, "Sign in."));
  expect((await h.handle(request(consent), id, "consent")).status).toBe(401); expect(h.service.consent).not.toHaveBeenCalled();
});
it("rejects omitted consent, client authority fields and invalid retry keys", async () => {
  const h = harness();
  for (const body of [{ ...consent, consent: false }, { ...consent, owner_id: id }, { ...consent, differenceMg: 0 }]) expect((await h.handle(request(body), id, "consent")).status).toBe(422);
  expect((await h.handle(request(consent, { "Idempotency-Key": "x" }), id, "consent")).status).toBe(422);
  expect(h.service.consent).not.toHaveBeenCalled();
});
it("binds a result route to the exact preview/hash, revision and retry identity", async () => {
  const h = harness(); expect((await h.handle(request(consent), id, "consent", "3")).status).toBe(200);
  expect(h.service.consent).toHaveBeenCalledWith(id, consent, "real-retry-key", expect.stringMatching(/^[a-f0-9]{64}$/), 3);
  expect((await h.handle(request(consent), id, "consent", "-1")).status).toBe(404);
});
it("uses separately reviewed public correction text and never accepts private report payloads", async () => {
  const h = harness(); expect((await h.handle(request({ correctionExplanation: "Public reason" }), id, "preview", "2")).status).toBe(200);
  expect(h.service.preview).toHaveBeenCalledWith(id, 2, "Public reason");
  expect((await h.handle(request({ correctionExplanation: "ok", note: "private" }), id, "preview", "2")).status).toBe(422);
});
it("private operation failures and infrastructure errors expose no backend details", async () => {
  const h = harness(); const response = await h.handle(new Request(`${origin}/api/v1/operations/${id}`), id, "operation"); expect(response.status).toBe(404);
  h.service.state.mockRejectedValueOnce(new Error("secret-backend-canary"));
  const failed = await h.handle(new Request(`${origin}/api/v1/plans/${id}/publication`), id, "state"); expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("secret-backend-canary");
});
