import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { consentRequestSchema, resultPreviewRequestSchema } from "@/contracts/publication";
import { idempotencyKeySchema } from "@/contracts/planning";
import { exportProofBundle } from "@/domain/proof";
import { parseDomain } from "@/domain/errors";
import { assertSameOrigin, readJson, readBody } from "@/server/http/request";
import { ApiError, publicFailure } from "@/server/http/errors";
import type { createPublicationService } from "./service";
import type { PublicationRepository } from "./repository";

type Member = { userId: string; service: ReturnType<typeof createPublicationService>; repository: PublicationRepository };
type Action = "preview" | "consent" | "state" | "bundle" | "operation";
export function createPublicationHandler(dependencies: { origin: () => string; authenticate: () => Promise<Member>; ingress: (owner: string) => Promise<void> }) {
  return async (request: Request, id: string, action: Action, revision?: string) => {
    const requestId = randomUUID(), headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "Referrer-Policy": "no-referrer" };
    try {
      if (action === "preview" || action === "consent") assertSameOrigin(request, dependencies.origin());
      const member = await dependencies.authenticate();
      if (!z.uuid().safeParse(id).success) throw new ApiError("NOT_FOUND", 404, "This record was not found.");
      if (action === "preview" || action === "consent") await dependencies.ingress(member.userId);
      const sequence = revision === undefined ? undefined : /^[1-9]\d{0,8}$/.test(revision) ? Number(revision) : null;
      if (sequence === null) throw new ApiError("NOT_FOUND", 404, "This result was not found.");
      if (action === "preview") {
        let explanation = "";
        if (sequence !== undefined) explanation = parseDomain(resultPreviewRequestSchema, await readJson(request)).correctionExplanation;
        else if (request.body !== null) {
          const body = await readBody(request);
          if (body !== "") { let json: unknown; try { json = JSON.parse(body); } catch { throw new ApiError("MALFORMED_JSON", 400, "Send a valid JSON request."); } parseDomain(z.strictObject({}), json); }
        }
        return Response.json({ data: await member.service.preview(id, sequence, explanation), requestId }, { headers });
      }
      if (action === "consent") {
        const input = parseDomain(consentRequestSchema, await readJson(request)), key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
        if (!key.success) throw new ApiError("INVALID_IDEMPOTENCY_KEY", 422, "Use a valid retry key.");
        const digest = createHash("sha256").update(JSON.stringify({ id, sequence: sequence ?? null, input })).digest("hex");
        return Response.json({ data: await member.service.consent(id, input, key.data, digest, sequence ?? null), requestId }, { headers });
      }
      if (action === "bundle") return new Response(exportProofBundle(await member.service.bundle(id)), { headers: { ...headers, "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="carbonshift-proof.json"' } });
      return Response.json({ data: action === "operation" ? await member.repository.operation(id) : await member.service.state(id), requestId }, { headers });
    } catch (error) { return publicFailure(error, requestId); }
  };
}
