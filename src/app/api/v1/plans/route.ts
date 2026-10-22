import { planHandlers } from "@/server/plans";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = planHandlers.list;
export const POST = planHandlers.accept;
