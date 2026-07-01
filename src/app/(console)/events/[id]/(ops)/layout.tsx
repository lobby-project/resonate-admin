import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { COL_TITLE, COL_VENUE } from "@/lib/schemaMap";
import EventTabs from "./EventTabs";
import BackLink from "../../../BackLink";

/* eslint-disable @typescript-eslint/no-explicit-any */
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

// 单场「操作中心」外壳:标题 + 核心 KPI + 分区切换,所有分区共用。
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: ev } = await svc.from("events").select("*").eq("id", id).eq("is_owned", true).single();
  if (!ev) notFound();

  const [{ data: orders }, { count: validTickets }, { count: goingCount }] = await Promise.all([
    svc.from("orders").select("status, total_cents").eq("event_id", id),
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
      <BackLink href="/events" label="Events" />
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
          Refunded {refunded.length} order{refunded.length === 1 ? "" : "s"} · {$(refundedSum)}
        </div>
      )}

      <EventTabs id={id} />

      {children}
    </div>
  );
}
