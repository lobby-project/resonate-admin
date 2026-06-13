import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { COL_TITLE, COL_VENUE } from "@/lib/schemaMap";
import CancelButton from "./CancelButton";

/* eslint-disable @typescript-eslint/no-explicit-any */
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

// 单场 Overview 仪表盘(对标 Wix 的 Event Overview + Stats)
export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: ev } = await svc.from("events").select("*").eq("id", id).eq("is_owned", true).single();
  if (!ev) notFound();

  const [{ data: orders }, { data: tiers }, { count: validTickets }, { count: goingCount }] =
    await Promise.all([
      svc.from("orders").select("status, total_cents").eq("event_id", id),
      svc
        .from("ticket_types")
        .select("id, name, is_visible, quantity_total, quantity_sold, pricing_method, price_cents")
        .eq("event_id", id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      svc.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "valid"),
      svc.from("event_attendees").select("event_id", { count: "exact", head: true }).eq("event_id", id),
    ]);

  const paid = (orders ?? []).filter((o: any) => o.status === "paid");
  const refunded = (orders ?? []).filter((o: any) => o.status === "refunded");
  const totalSales = paid.reduce((s: number, o: any) => s + o.total_cents, 0);
  const refundedSum = refunded.reduce((s: number, o: any) => s + o.total_cents, 0);

  const title = (ev as Record<string, any>)[COL_TITLE];
  const dateLabel = ev.date_tbd
    ? "DATE TBD"
    : ev.event_date
      ? new Date(ev.event_date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "—";

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{title}</h1>
          <div className="small muted" style={{ marginTop: 6 }}>
            {dateLabel}
            {(ev as Record<string, any>)[COL_VENUE] ? ` · ${(ev as Record<string, any>)[COL_VENUE]}` : ""}
            {" · "}
            {ev.event_type === "rsvp" ? "RSVP" : "TICKETED"}
          </div>
        </div>
        <span className={"badge " + (ev.status === "published" ? "live" : ev.status === "canceled" ? "" : "draft")}>
          {String(ev.status).toUpperCase()}
        </span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-n">{$(totalSales)}</div>
          <div className="stat-l">TOTAL SALES</div>
        </div>
        <div className="stat">
          <div className="stat-n">{paid.length}</div>
          <div className="stat-l">PAID ORDERS</div>
        </div>
        <div className="stat">
          <div className="stat-n">{validTickets ?? 0}</div>
          <div className="stat-l">TICKETS VALID</div>
        </div>
        <div className="stat">
          <div className="stat-n">{goingCount ?? 0}</div>
          <div className="stat-l">GOING</div>
        </div>
      </div>
      {refundedSum > 0 && (
        <div className="small muted" style={{ marginBottom: 18 }}>
          已退款 {refunded.length} 单 · {$(refundedSum)}
        </div>
      )}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 14 }}>
          TICKET SALES
        </div>
        {(tiers ?? []).length === 0 && <div className="small muted">没有票档(RSVP 活动正常)</div>}
        {(tiers ?? []).map((t: any) => {
          const pct = t.quantity_total ? Math.min(100, Math.round((t.quantity_sold / t.quantity_total) * 100)) : null;
          return (
            <div key={t.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#fff", fontSize: 13 }}>
                  {t.name}
                  {!t.is_visible && <span className="badge draft" style={{ marginLeft: 8 }}>HIDDEN</span>}
                </span>
                <span className="small muted">
                  {t.quantity_total == null ? `${t.quantity_sold} 已售 · 不限量` : `${t.quantity_sold}/${t.quantity_total}`}
                </span>
              </div>
              {pct != null && (
                <div className="bar">
                  <div className="bar-in" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/events/${id}/edit`} className="btn">EDIT EVENT</Link>
        <Link href={`/orders?event=${id}`} className="btn">VIEW ORDERS →</Link>
        {ev.status !== "canceled" && <CancelButton eventId={id} />}
      </div>
      {ev.status === "canceled" && (
        <p className="small muted" style={{ marginTop: 14 }}>
          活动已取消,售卖已关闭。退款请到 ORDERS 里逐单执行(钱的事一单一单确认)。
        </p>
      )}
    </div>
  );
}
