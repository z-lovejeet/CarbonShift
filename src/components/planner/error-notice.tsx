import Link from "next/link";
import { PlanningFailure } from "@/lib/planning-api";

export function ErrorNotice({ error }: { error: Error }) {
  return <div className="notice error-notice" role="alert">
    <p>{error.message}</p>
    {error instanceof PlanningFailure && error.requestId ? <p className="reference">Reference: {error.requestId}</p> : null}
    {error instanceof PlanningFailure && error.code === "UNAUTHENTICATED" ? <Link href="/login" target="_blank" rel="noreferrer" className="text-link">Sign in in another tab, then retry here</Link> : null}
  </div>;
}
