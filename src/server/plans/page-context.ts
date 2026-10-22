import "server-only";
import { redirect } from "next/navigation";
import { requireMember } from "@/server/auth/session";
import { createServiceClient } from "@/server/db/clients";
import { ApiError } from "@/server/http/errors";
import { createPlanRepository } from "./repository";

export async function pageContext() {
  try {
    const member = await requireMember();
    return { member, repository: createPlanRepository(member.client, createServiceClient(), member.userId) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    throw error;
  }
}
