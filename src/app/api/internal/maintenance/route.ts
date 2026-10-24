import { randomUUID } from "node:crypto";
import { authorizeMaintenance, runMaintenance } from "@/server/maintenance";
import { createServiceClient } from "@/server/db/clients";
import { getWebEnvironment } from "@/server/env";
import { publicFailure } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const requestId = randomUUID();
  try {
    authorizeMaintenance(request, getWebEnvironment().maintenanceSecret);
    const data = await runMaintenance(createServiceClient(), true);
    return Response.json({ data, requestId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return publicFailure(error, requestId); }
}
