"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 单场操作中心的分区切换。门票 = 默认(精确匹配 base),其余 startsWith。
// /events/[id]/edit(创建向导)不归任何分区,故不会高亮。
export default function EventTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/events/${id}`;
  const tabs = [
    { href: base, label: "门票", exact: true },
    { href: `${base}/promos`, label: "促销" },
    { href: `${base}/data`, label: "数据" },
    { href: `${base}/orders`, label: "订单 & 名单" },
    { href: `${base}/settings`, label: "设置" },
  ];

  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 22, flexWrap: "wrap" }}>
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
              borderBottom: active ? "2px solid var(--green)" : "2px solid transparent",
              marginBottom: -1,
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
