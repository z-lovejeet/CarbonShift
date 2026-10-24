import "server-only";
import { randomUUID } from "node:crypto";
import { ACTIVITY_PROFILES } from "@/data/activity-profiles";
import { assertSameOrigin, readJson } from "@/server/http/request";
import { publicFailure } from "@/server/http/errors";
import { simulateActivity, type SimulationSources } from "./service";

export function createActivityHandlers(deps: { origin: () => string; requireMember(): Promise<{ userId: string }>; admit(userId: string): Promise<void>; sources: SimulationSources; nowUtc(): string }) {
  return {
    async profiles() {
      const requestId = randomUUID();
      try {
        const { userId } = await deps.requireMember(); await deps.admit(userId);
        return Response.json({ data: { schemaVersion: 2, profiles: ACTIVITY_PROFILES }, requestId }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (error) { return publicFailure(error, requestId); }
    },
    async simulate(request: Request) {
      const requestId = randomUUID();
      try {
        assertSameOrigin(request, deps.origin());
        const { userId } = await deps.requireMember(); await deps.admit(userId);
        const input = await readJson(request);
        const data = await simulateActivity(input, deps.sources, deps.nowUtc);
        return Response.json({ data, requestId }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (error) { return publicFailure(error, requestId); }
    },
  };
}
