import { expect, it } from "vitest";
import { issueProof, readProof, sessionBinding, proofCookie } from "@/server/auth/reauth-proof";
const owner = "eb18a200-4098-49d4-ac88-8a3061affc50", session = "3bdd42f5-ae4d-42ec-9133-6b78d6aa3dc4", secret = "authored-secret-for-isolated-reauth-tests";
it("T02 deletion proof is owner/session/purpose bound with a strict ten-minute lifetime", () => {
  const token = issueProof("receipt", owner, session, secret, 1000);
  expect(readProof(token, "receipt", secret, 1001)).toMatchObject({ owner, binding: session });
  expect(readProof(token, "intent", secret, 1001)).toBeNull();
  expect(readProof(token, "receipt", secret, 1600)).toBeNull();
  expect(readProof(token, "receipt", secret, 999)).toBeNull();
  expect(readProof(token, "receipt", "wrong-key", 1001)).toBeNull();
  expect(readProof(token + "tamper", "receipt", secret, 1001)).toBeNull();
});
it("T02 session binding is explicit and cookies cannot be read by scripts", () => {
  expect(sessionBinding("x." + Buffer.from(JSON.stringify({ session_id: session })).toString("base64url") + ".x")).toBe(session);
  expect(sessionBinding("broken")).toBeNull();
  expect(proofCookie("proof", "value", "https://example.test")).toContain("HttpOnly; SameSite=Lax; Max-Age=600; Secure");
});
