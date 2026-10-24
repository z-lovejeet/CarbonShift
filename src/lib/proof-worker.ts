import { verifyVersionedBundle } from "@/domain/proof/versions";
import type { VerificationContext } from "@/domain/proof/observations";
self.onmessage = (event: MessageEvent<{ id: number; text: string; context?: VerificationContext }>) => {
  try { self.postMessage({ id: event.data.id, report: verifyVersionedBundle(event.data.text, event.data.context) }); }
  catch { self.postMessage({ id: event.data.id, error: "This bundle could not be checked safely." }); }
};
