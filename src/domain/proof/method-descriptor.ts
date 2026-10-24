import { freezeDomain, METHOD } from "../method";
import { methodDescriptorSchema } from "./schemas";

const { version, ...constants } = METHOD;
/** A supported algorithm identity, not a measurement or source-authenticity attestation. */
export const METHOD_DESCRIPTOR = freezeDomain(methodDescriptorSchema.parse({
  schemaVersion: 1, methodVersion: version, algorithm: "gb-half-hour-uniform-integer-overlap-v1",
  constants,
  rules: {
    profile: "Distribute integer Wh uniformly: floor(total/bins), then one extra Wh in each earliest remainder bin. Energy is assumed, never metered.",
    forecast: "Sum Wh times forecast g/kWh as integer mg, without per-bin rounding. Full aligned half-hour coverage and fresh snapshot required.",
    actual: "Use exact integer overlap seconds for the same assumed profile against national actual factors; round the final nonnegative rational mg half up once. Missing factors yield null amounts. Difference is baseline minus reported and may be negative.",
    selection: "Enumerate every feasible aligned start at comparison creation plus the operational buffer, subject to horizon, deadline and blocked intervals. Minimize integer mg; break ties by earliest UTC start. Acceptance must precede expiry.",
    evidence: "GB national consumption signal; one washing cycle. Live execution is self-reported, demo simulated. A matching hash proves recorded content, not physical action or measured avoided emissions.",
    cancellation: "Before selected start only, without a preceding report or result; terminal non-run, null profile and amounts. Ordinary non-run reporting requires selected end to have passed.",
  },
}));

/** Version-1 pin independently checked with Node SHA-256 in the golden-vector tests. */
export const SUPPORTED_METHOD_HASH = "0xfa7e337b043fc55656eaa4eb038de5234e5987313545a7c5e442062f2a361f9d";
