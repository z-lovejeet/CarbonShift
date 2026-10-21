import { freezeDomain } from "@/domain/method";
import fixture from "./gb-uniform-v1.json" with { type: "json" };

/** Import only in the labeled demo or isolated tests. Never a live-data fallback. */
export const GB_UNIFORM_V1_FIXTURE = freezeDomain(fixture);
