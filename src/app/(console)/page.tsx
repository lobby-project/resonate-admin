import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDashboardData } from "./dashboard/data";

const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

// Dashboard 首屏:KPI 一排 → 即将到来的活动(带进度) → 最近订单。只读聚合。
export default async function DashboardPage() {
  const { svc } = await requireAdmin();
  const d = await getDashboardData(svc);

  return (
    <div>
      <div className="page-h">
        <h1>DASHBOARD</h1>
      </div>

      {/* KPI 卡一排 */}
      <div className="stat-row">
        <div className="stat">
          <div className="stat-n">{$(d.revenueCents)}</div>
          <div className="stat-l">TOTAL REVENUE</div>
        </div>
        <div className="stat">
          <div className="stat-n">{d.ticketsSold}</div>
          <div className="stat-l">TICKETS SOLD</div>
        </div>
        <div className="stat">
          <div className="stat-n">{d.upcoming.length}</div>
          <div className="stat-l">UPCOMING EVENTS</div>
        </div>
        <div className="stat">
          <div className="stat-n">{d.pendingOrders}</div>
          <div className="stat-l">PENDING ORDERS</div>
        </div>
      </div>

      {/* 即将到来的活动(带销售进度条) */}
      <div className="small muted" style={{ letterSpacing: ".14em", margin: "28px 0 10px" }}>
        UPCOMING
      </div>
      {d.upcoming.length === 0 && (
        <div className="panel muted small">没有即将到来的已发布活动。</div>
      )}
      {d.upcoming.map((e) => {
        const pct = e.total && e.total > 0 ? Math.min(100, Math.round((e.sold / e.total) * 100)) : 0;
        const date = e.event_date
          ? new Date(e.event_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          : "—";
        return (
          <Link key={e.id} href={`/events/${e.id}`}>
            <div className="panel" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ color: "#fff" }}>{e.artist || "UNTITLED EVENT"}</div>
                <div className="small muted">
                  {date}
                  {e.event_time ? ` · ${e.event_time}` : ""}
                </div>
              </div>
              {e.total != null ? (
                <>
                  <div className="bar">
                    <div className="bar-in" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="small muted" style={{ marginTop: 6 }}>
                    {e.sold} / {e.total} sold · {pct}%
                  </div>
                </>
              ) : (
                <div className="small muted">{e.sold} sold · 无限库存</div>
              )}
            </div>
          </Link>
        );
      })}

      {/* 最近订单 8 条 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "28px 0 10px" }}>
        <div className="small muted" style={{ letterSpacing: ".14em" }}>RECENT ORDERS</div>
        <Link href="/orders" className="small green">VIEW ALL →</Link>
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
            {d.recent.length === 0 && (
              <tr>
                <td colSpan={5} className="muted small">还没有订单</td>
              </tr>
            )}
            {d.recent.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/orders/${o.id}`} className="green">
                    {o.attendee_name || "—"}
                  </Link>
                </td>
                <td className="muted">{o.eventTitle ?? "—"}</td>
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
