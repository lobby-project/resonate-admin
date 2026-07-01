import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDashboardData } from "./dashboard/data";

const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

/* 小图标(stroke,继承 currentColor=薄荷青) */
const IcoRevenue = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);
const IcoTicket = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9z" />
    <path d="M14 7v10" strokeDasharray="2 2" />
  </svg>
);
const IcoCalendar = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
  </svg>
);
const IcoClock = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

// Dashboard 首屏:KPI 一排 → 即将到来的活动(带进度) → 最近订单。只读聚合。
export default async function DashboardPage() {
  const { svc } = await requireAdmin();
  const d = await getDashboardData(svc);

  const kpis = [
    { ico: IcoRevenue, n: $(d.revenueCents), l: "TOTAL REVENUE" },
    { ico: IcoTicket, n: d.ticketsSold, l: "TICKETS SOLD" },
    { ico: IcoCalendar, n: d.upcoming.length, l: "UPCOMING EVENTS" },
    { ico: IcoClock, n: d.pendingOrders, l: "PENDING ORDERS" },
  ];

  return (
    <div className="dash">
      <div className="dash-h">
        <h1>Dashboard</h1>
        <div className="dash-sub">Overview · All owned events</div>
      </div>

      {/* KPI 卡一排 */}
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.l} className="kpi">
            <div className="kpi-ico">{k.ico}</div>
            <div className="kpi-n">{k.n}</div>
            <div className="kpi-l">{k.l}</div>
          </div>
        ))}
      </div>

      {/* 即将到来的活动(带销售进度条) */}
      <div className="card">
        <div className="card-h">
          <h2>Upcoming</h2>
          <Link href="/events" className="card-link">All Events →</Link>
        </div>
        {d.upcoming.length === 0 && <div className="card-empty">No upcoming published events.</div>}
        {d.upcoming.map((e) => {
          const pct = e.total && e.total > 0 ? Math.min(100, Math.round((e.sold / e.total) * 100)) : 0;
          const date = e.event_date
            ? new Date(e.event_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
            : "—";
          return (
            <Link key={e.id} href={`/events/${e.id}`} className="up-row">
              <div className="up-top">
                <span className="up-name">{e.artist || "UNTITLED EVENT"}</span>
                <span className="up-date">
                  {date}
                  {e.event_time ? ` · ${e.event_time}` : ""}
                </span>
              </div>
              {e.total != null ? (
                <>
                  <div className="up-bar">
                    <div className="up-bar-in" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="up-meta">
                    {e.sold} / {e.total} sold · {pct}%
                  </div>
                </>
              ) : (
                <div className="up-meta">{e.sold} sold · Unlimited inventory</div>
              )}
            </Link>
          );
        })}
      </div>

      {/* 最近订单 */}
      <div className="card">
        <div className="card-h">
          <h2>Recent Orders</h2>
          <Link href="/orders" className="card-link">View All →</Link>
        </div>
        <table className="dtbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Event</th>
              <th>Time</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {d.recent.length === 0 && (
              <tr>
                <td colSpan={5} className="card-empty">No orders yet</td>
              </tr>
            )}
            {d.recent.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/orders/${o.id}`}>{o.attendee_name || "—"}</Link>
                </td>
                <td style={{ color: "var(--text-3)" }}>{o.eventTitle ?? "—"}</td>
                <td style={{ color: "var(--text-3)" }}>
                  {new Date(o.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </td>
                <td>
                  <span className={"pill " + o.status}>{o.status.toUpperCase()}</span>
                </td>
                <td style={{ textAlign: "right", color: "var(--text)" }}>{$(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
