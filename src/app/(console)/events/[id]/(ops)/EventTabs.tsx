"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 单场操作中心的分区切换。门票 = 默认(精确匹配 base),其余 startsWith。
// /events/[id]/edit(创建向导)不归任何分区,故不会高亮。
export default function EventTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/events/${id}`;
  const tabs = [
    { href: base, label: "Tickets", exact: true },
    { href: `${base}/promos`, label: "Promotions" },
    { href: `${base}/data`, label: "Analytics" },
    { href: `${base}/orders`, label: "Orders & Guests" },
    { href: `${base}/settings`, label: "Settings" },
  ];

  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 22, overflowX: "auto", whiteSpace: "nowrap" }}>
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={"small" + (active ? " green" : " muted")}
            style={{
              padding: "10px 14px",
              letterSpacing: ".1em",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
