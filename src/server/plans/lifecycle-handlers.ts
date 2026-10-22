import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { cancelRequestSchema, lifecycleAckSchema, refreshRequestSchema, reportRequestSchema } from "@/contracts/lifecycle";
import { idempotencyKeySchema } from "@/contracts/planning";
import { parseDomain } from "@/domain/errors";
import { assertSameOrigin, readJson, readBody } from "@/server/http/request";
import { ApiError, publicFailure } from "@/server/http/errors";
import { createLifecycleService } from "./lifecycle";
import type { GridSnapshotRecord } from "@/server/grid/snapshot";
import type { LifecycleRepository } from "./lifecycle-repository";

type Member = { userId: string; repository: LifecycleRepository; reauthenticate: () => Promise<void> };
type Dependencies = { authenticate: (request: Request) => Promise<Member>; origin: () => string; now: () => string;
  actual: (range: { fromUtc: string; toUtc: string }) => Promise<GridSnapshotRecord | null>; ingress: (userId: string) => Promise<void> };
export function createLifecycleHandlers(dependencies: Dependencies) {
  return async function handle(request: Request, planId: string, action: "report" | "cancel" | "refresh" | "delete") {
    const requestId = randomUUID();
    try {
      assertSameOrigin(request, dependencies.origin());
      const member = await dependencies.authenticate(request); await dependencies.ingress(member.userId);
      if (!z.uuid().safeParse(planId).success) throw new ApiError("NOT_FOUND", 404, "This plan was not found.");
      const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
      if (!key.success) throw new ApiError("INVALID_IDEMPOTENCY_KEY", 422, "Use a valid retry key.");
      const input = action === "report" ? parseDomain(reportRequestSchema, await readJson(request)) : action === "cancel" ? parseDomain(cancelRequestSchema, await readJson(request)) : action === "refresh" ? parseDomain(refreshRequestSchema, await readJson(request)) : null;
      if (action === "delete") {
        if (request.body !== null && await readBody(request, 1) !== "") throw new ApiError("INVALID_INPUT", 422, "Deletion does not accept a request body.");
        await member.reauthenticate();
      }
      const digest = createHash("sha256").update(JSON.stringify({ action, planId, input })).digest("hex");
      const service = createLifecycleService({ repository: member.repository, now: dependencies.now, actual: dependencies.actual });
      const response = action === "report" ? await service.report(planId, reportRequestSchema.parse(input), key.data, digest)
        : action === "cancel" ? await service.cancel(planId, key.data, digest, cancelRequestSchema.parse(input).reason)
          : action === "refresh" ? await service.refresh(planId, refreshRequestSchema.parse(input).expectedResultRevision, key.data, digest) : await service.delete(planId, key.data, digest);
      return Response.json({ data: lifecycleAckSchema.parse(response), requestId }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
    } catch (error) { return publicFailure(error, requestId); }
  };
}
