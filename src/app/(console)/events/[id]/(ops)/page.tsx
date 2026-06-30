import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import TicketManager from "../edit/TicketTiers";

/* eslint-disable @typescript-eslint/no-explicit-any */

// 门票分区(默认):票档售卖进度(只读) + 票档/RSVP 管理(增删改,复用向导面板)。
export default async function EventTicketsSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: ev } = await svc.from("events").select("*").eq("id", id).eq("is_owned", true).single();
  if (!ev) notFound();

  const { data: tiers } = await svc
    .from("ticket_types")
    .select("*")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const list = tiers ?? [];
  const isRsvp = ev.event_type === "rsvp";

  return (
    <div>
      {!isRsvp && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 14 }}>
            TICKET SALES
          </div>
          {list.length === 0 && <div className="small muted">还没有票档 —— 在下面添加</div>}
          {list.map((t: any) => {
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
      )}

      <div className="panel">
        <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 16 }}>
          {isRsvp ? "RSVP 设置" : "管理票档"}
        </div>
        <TicketManager event={ev} tiers={list} />
      </div>
    </div>
  );
}
