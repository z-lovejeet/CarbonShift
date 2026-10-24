"use client";
import { HANDOFF_KEY } from "@/lib/schedule-input";
export function SignOutForm({ className = "button secondary" }: { className?: string }) {
  return <form action="/auth/sign-out" method="post" onSubmit={() => { try { sessionStorage.removeItem(HANDOFF_KEY); } catch { /* Storage may be disabled. */ } }}><button className={className} type="submit">Sign out</button></form>;
}
