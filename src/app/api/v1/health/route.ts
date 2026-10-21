import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness only. Provider, database and worker readiness are separate checks.
export function GET() {
  return Response.json({ data: { status: "ok" }, requestId: randomUUID() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
