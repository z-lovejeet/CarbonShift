import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireMember } from "@/server/auth/session";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { ApiError, publicFailure } from "@/server/http/errors";
import { assertSameOrigin, readBody } from "@/server/http/request";
import { mutationIngress } from "@/server/limits/ingress";
import { canonicalJson, digest, subject } from "@/server/limits/budgets";
import { createPlanRepository } from "@/server/plans/repository";
import { gridClient } from "@/server/grid";
import { createScheduleRepository } from "./repository";
import { calculateSchedule } from "./calculation";
import { acceptScheduleRequestSchema } from "@/contracts/schedules";
import { parseDomain } from "@/domain/errors";
async function body(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new ApiError("INVALID_CONTENT_TYPE", 415, "Send a JSON request.");
  try { return JSON.parse(await readBody(request, 32768)) as unknown; } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError("MALFORMED_JSON", 400, "Check the request format."); }
}
export async function scheduleRequest(request: Request, action: "compare" | "accept" | "list" | "detail", id?: string) {
  const requestId = randomUUID();
  try {
    const config = databaseConfiguration(); if (request.method !== "GET") assertSameOrigin(request, config.origin);
    const member = await requireMember(), writer = createServiceClient();
    if (request.method !== "GET") await mutationIngress(member.userId);
    const repository = createScheduleRepository(member.client, writer, member.userId); let data: unknown;
    if (action === "compare") {
      await createPlanRepository(member.client, writer, member.userId).reserveComparisonQuota(subject(config.hmac, "comparison", member.userId));
      data = await calculateSchedule(await body(request), gridClient, () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
      await repository.saveComparison(data as Awaited<ReturnType<typeof calculateSchedule>>);
    } else if (action === "accept") {
      const parsed = parseDomain(acceptScheduleRequestSchema, await body(request)), key = z.uuid().safeParse(request.headers.get("Idempotency-Key"));
      if (!key.success) throw new ApiError("INVALID_INPUT", 422, "Use a valid save request key.");
      data = await repository.accept(parsed.comparisonId, parsed.optionIndex, key.data, digest(canonicalJson({ route: "v2/schedules", ...parsed })));
    } else if (action === "detail") {
      if (!z.uuid().safeParse(id).success) throw new ApiError("NOT_FOUND", 404, "This schedule was not found."); data = await repository.detail(id!);
    } else {
      const query = new URL(request.url).searchParams;
      if ([...query.keys()].some((key) => !["limit", "cursor"].includes(key) || query.getAll(key).length !== 1)) throw new ApiError("INVALID_INPUT", 422, "Use only one limit and one cursor query field.");
      const limit = z.coerce.number().int().min(1).max(20).safeParse(query.get("limit") ?? 20), cursor = query.get("cursor");
      if (!limit.success || (cursor && cursor.length > 500)) throw new ApiError("INVALID_INPUT", 422, "Use a valid page size or cursor."); data = await repository.page(limit.data, cursor ?? undefined);
    }
    return Response.json({ data, requestId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return publicFailure(e, requestId); }
}
