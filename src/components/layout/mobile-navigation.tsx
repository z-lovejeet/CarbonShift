"use client";
import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { navigationItems, navigationCurrent } from "./primary-navigation";
export function MobileNavigation() {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  return <details className="mobile-navigation" ref={menu}><summary>Menu</summary><nav aria-label="Mobile navigation">{navigationItems.map(([href, label]) => <Link href={href} key={href} aria-current={navigationCurrent(href, pathname) ? "page" : undefined} onClick={() => menu.current?.removeAttribute("open")}>{label}</Link>)}</nav></details>;
}
