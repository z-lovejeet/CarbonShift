import "server-only";
import { requireMember } from "@/server/auth/session";
import { assertRecentReauth } from "@/server/auth/reauth";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { gridClient } from "@/server/grid";
import { mutationIngress } from "@/server/limits/ingress";
import { createPlanRepository } from "./repository";
import { createLifecycleRepository } from "./lifecycle-repository";
import { createLifecycleHandlers } from "./lifecycle-handlers";
export const lifecycleHandler = createLifecycleHandlers({
  async authenticate(request) {
    const member = await requireMember(); const writer = createServiceClient();
    return { userId: member.userId, repository: createLifecycleRepository(createPlanRepository(member.client, writer, member.userId), writer, member.userId), reauthenticate: () => assertRecentReauth(request, member) };
  },
  ingress: mutationIngress, origin: () => databaseConfiguration().origin, now: () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), actual: (range) => gridClient.getActual(range),
});
