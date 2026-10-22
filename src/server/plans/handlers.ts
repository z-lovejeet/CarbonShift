import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { parseDomain } from "@/domain/errors";
import { feasibleStarts, normalizeConstraints, planningCoverageStart } from "@/domain/constraints";
import { createComparison } from "@/domain/scheduling";
import { ceilHalfHour } from "@/domain/time";
import type { GridSnapshotRecord } from "@/server/grid/snapshot";
import { ApiError, publicFailure } from "@/server/http/errors";
import { assertSameOrigin, readJson } from "@/server/http/request";
import { acceptanceRequestSchema, comparisonDocumentSchema, comparisonViewSchema, comparisonRequestSchema, idempotencyKeySchema, pageRequestSchema, planSchema, planSummarySchema } from "./contracts";
import type { PlanRepository } from "./repository";

type Dependencies = {
  authenticate: () => Promise<{ userId: string; repository: PlanRepository }>;
  origin: () => string; hmacSecret: () => string; now: () => string;
  forecast: (range: { fromUtc: string; toUtc: string }) => Promise<GridSnapshotRecord>;
  ingress?: (userId: string) => Promise<void>;
};
export function createPlanHandlers(dependencies: Dependencies) {
  async function execute(request: Request, mutation: boolean, action: (member: Awaited<ReturnType<Dependencies["authenticate"]>>) => Promise<unknown>) {
    const requestId = randomUUID();
    try {
      if (mutation) assertSameOrigin(request, dependencies.origin());
      const member = await dependencies.authenticate();
      if (mutation) await dependencies.ingress?.(member.userId);
      const data = await action(member);
      return Response.json({ data, requestId }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
    } catch (error) { return publicFailure(error, requestId); }
  }
  return {
    compare: (request: Request) => execute(request, true, async ({ userId, repository }) => {
      const input = parseDomain(comparisonRequestSchema, await readJson(request));
      const confirmedAtUtc = dependencies.now();
      const { baseline, constraintsConfirmed: _confirmed, ...fields } = input;
      void _confirmed;
      let constraints = normalizeConstraints({ ...fields, baselineStartUtc: baseline.kind === "user_selected" ? baseline.startUtc : input.earliestStartUtc,
        baselineOrigin: baseline.kind === "user_selected" ? "user_selected" : "earliest_feasible_confirmed", confirmedAtUtc });
      const starts = feasibleStarts(constraints, confirmedAtUtc);
      if (baseline.kind === "earliest_feasible") constraints = normalizeConstraints({ ...constraints, baselineStartUtc: starts[0] });
      const subject = createHmac("sha256", dependencies.hmacSecret()).update(`comparison:${userId}`).digest("hex");
      await repository.reserveComparisonQuota(subject);
      const record = await dependencies.forecast({ fromUtc: planningCoverageStart(constraints, confirmedAtUtc), toUtc: ceilHalfHour(input.deadlineUtc) });
      const comparison = createComparison({ constraints, snapshot: record.snapshot, forecastSnapshotId: record.id, forecastSnapshotHash: record.hash }, dependencies.now());
      const id = randomUUID();
      await repository.saveComparison(id, record, comparison);
      return comparisonDocumentSchema.parse({ ...comparison, schemaVersion: 1, id, version: 1 });
    }),
    comparison: (request: Request, id: string) => execute(request, false, async ({ repository }) => {
      if (!z.uuid().safeParse(id).success) throw new ApiError("NOT_FOUND", 404, "This comparison was not found.");
      return comparisonViewSchema.parse(await repository.comparison(id));
    }),
    accept: (request: Request) => execute(request, true, async ({ repository }) => {
      const input = parseDomain(acceptanceRequestSchema, await readJson(request));
      const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
      if (!key.success) throw new ApiError("INVALID_IDEMPOTENCY_KEY", 422, "Use a request key containing 8–128 letters, digits, underscores or hyphens.");
      const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      return planSchema.parse(await repository.accept(input.comparisonId, input.comparisonVersion, key.data, digest));
    }),
    list: (request: Request) => execute(request, false, async ({ repository }) => {
      const parameters = new URL(request.url).searchParams;
      if ([...parameters.keys()].some((key) => parameters.getAll(key).length !== 1)) throw new ApiError("INVALID_INPUT", 422, "Use one value for each page parameter.");
      const input = parseDomain(pageRequestSchema, Object.fromEntries(parameters));
      return z.strictObject({ items: z.array(planSummarySchema), nextCursor: z.string().nullable() }).parse(await repository.page(input.limit, input.cursor));
    }),
    detail: (request: Request, id: string) => execute(request, false, async ({ repository }) => {
      if (!z.uuid().safeParse(id).success) throw new ApiError("NOT_FOUND", 404, "This plan was not found.");
      return planSchema.parse(await repository.detail(id));
    }),
  };
}
