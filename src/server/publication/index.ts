import "server-only";
import { requireMember } from "@/server/auth/session";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { createPlanRepository } from "@/server/plans/repository";
import { mutationIngress } from "@/server/limits/ingress";
import { getWebEnvironment } from "@/server/env";
import { ApiError } from "@/server/http/errors";
import { createPublicationRepository } from "./repository";
import { createPublicationService } from "./service";
import { createPublicationHandler } from "./handlers";

export const publicationHandler = createPublicationHandler({
  origin: () => databaseConfiguration().origin, ingress: mutationIngress,
  async authenticate() {
    const member = await requireMember(), writer = createServiceClient();
    const repository = createPublicationRepository(member.client, writer, member.userId);
    return { userId: member.userId, repository, service: createPublicationService(createPlanRepository(member.client, writer, member.userId), repository, () => {
      const ledger = getWebEnvironment().ledger;
      if (!ledger.enabled) throw new ApiError("LEDGER_UNAVAILABLE", 503, "Publication is unavailable. Your private plan remains usable.", true);
      return ledger.contractAddress;
    }) };
  },
});
