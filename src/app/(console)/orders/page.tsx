import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { COL_TITLE } from "@/lib/schemaMap";

/* eslint-disable @typescript-eslint/no-explicit-any */
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;
const STATUSES = ["all", "paid", "pending", "refunded", "canceled"] as const;

// ORDERS — 全部订单(可按活动/状态筛、按入场姓名搜、CSV 导出)
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const { svc } = await requireAdmin();

  let q = svc
    .from("orders")
    .select(`id, status, total_cents, attendee_name, created_at, event_id, events ( ${COL_TITLE} )`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (sp.event) q = q.eq("event_id", sp.event);
  if (sp.status && sp.status !== "all") q = q.eq("status", sp.status);
  if (sp.q) q = q.ilike("attendee_name", `%${sp.q}%`);
  const { data: orders } = await q;

  const list = (orders ?? []) as any[];
  const totalPaid = list.filter((o) => o.status === "paid").reduce((s, o) => s + o.total_cents, 0);

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return "/orders" + (qs ? `?${qs}` : "");
  };
  const csvHref = (() => {
    const p = new URLSearchParams();
    if (sp.event) p.set("event", sp.event);
    if (sp.status && sp.status !== "all") p.set("status", sp.status);
    const qs = p.toString();
    return "/api/export/orders" + (qs ? `?${qs}` : "");
  })();

  return (
    <div>
      <div className="page-h">
        <h1>
          ORDERS <span className="small muted">({list.length}{sp.event ? " · 本场" : ""} · paid 合计 {$(totalPaid)})</span>
        </h1>
        <a href={csvHref} className="btn">EXPORT CSV ↓</a>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={link({ status: s === "all" ? undefined : s })}
            className={"badge " + ((sp.status ?? "all") === s ? "live" : "")}
          >
            {s.toUpperCase()}
          </Link>
        ))}
        <form action="/orders" method="get" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {sp.event && <input type="hidden" name="event" value={sp.event} />}
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="搜入场姓名…"
            style={{ background: "#0b0b0b", border: "1px solid var(--border)", borderRadius: 6, color: "#fff", fontFamily: "inherit", fontSize: 12, padding: "8px 10px" }}
          />
          <button className="btn btn-sm">SEARCH</button>
        </form>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>NAME</th>
              <th>EVENT</th>
              <th>DATE</th>
              <th>STATUS</th>
              <th style={{ textAlign: "right" }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="muted small">没有符合条件的订单</td>
              </tr>
            )}
            {list.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/orders/${o.id}`} className="green">
                    {o.attendee_name || "—"}
                  </Link>
                </td>
                <td className="muted">{o.events?.[COL_TITLE] ?? "—"}</td>
                <td className="muted small">
                  {new Date(o.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </td>
                <td>
                  <span className={"badge " + (o.status === "paid" ? "live" : "")}>{o.status.toUpperCase()}</span>
                </td>
                <td style={{ textAlign: "right" }}>{$(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
