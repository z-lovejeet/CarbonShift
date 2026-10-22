"use client";
import Link from "next/link";
import { useRef } from "react";
export function MobileNavigation() {
  const menu = useRef<HTMLDetailsElement>(null);
  return <details className="mobile-navigation" ref={menu}><summary>Menu</summary><nav aria-label="Mobile navigation">{[["/app", "Plans"], ["/demo", "Example"], ["/app/settings", "Account"]].map(([href, label]) => <Link href={href!} key={href} onClick={() => menu.current?.removeAttribute("open")}>{label}</Link>)}</nav></details>;
}
