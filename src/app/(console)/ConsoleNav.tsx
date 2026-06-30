"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "DASHBOARD" },
  { href: "/events", label: "EVENTS" },
  { href: "/orders", label: "ORDERS" },
];

// 控制台导航(active 高亮按真实 pathname,不写死)。
export default function ConsoleNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={"nav-i" + (isActive(l.href) ? " active" : "")}>
          {l.label}
        </Link>
      ))}
    </>
  );
}
