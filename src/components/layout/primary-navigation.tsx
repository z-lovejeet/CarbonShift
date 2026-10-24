"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const navigationItems = [["/app", "Plans"], ["/app/simulate", "Simulate"], ["/app/plan/new", "Plan tasks"], ["/app/day/new", "Plan my day"], ["/app/settings", "Account"]] as const;
export function navigationCurrent(href: string, pathname: string | null) { return pathname !== null && (href === "/app" ? pathname === "/app" || pathname.startsWith("/app/plans/") : pathname === href); }

export function PrimaryNavigation() {
  const pathname = usePathname();
  return <nav className="desktop-navigation" aria-label="Primary navigation">{navigationItems.map(([href, label]) => <Link href={href} key={href} className="nav-link" aria-current={navigationCurrent(href, pathname) ? "page" : undefined}>{label}</Link>)}</nav>;
}
