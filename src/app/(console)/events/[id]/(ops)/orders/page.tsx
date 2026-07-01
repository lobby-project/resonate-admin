import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

/* eslint-disable @typescript-eslint/no-explicit-any */
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

// 订单 & 名单分区:本场订单(精简表,行→详情→退款,现成) + GOING 实名名单。
export default async function EventOrdersSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: ev } = await svc.from("events").select("id").eq("id", id).eq("is_owned", true).single();
  if (!ev) notFound();

  const { data: orders } = await svc
    .from("orders")
    .select("id, status, total_cents, attendee_name, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const list = (orders ?? []) as any[];

  // GOING 名单:两步 .in() 拼装(产品端到处这么 join,不赌 FK embed)。
  // 1) event_attendees 拿 going 的人 + Listener 编号 + 报名时间
  const { data: attendees } = await svc
    .from("event_attendees")
    .select("user_id, anon_num, created_at")
    .eq("event_id", id)
    .eq("status", "going")
    .order("anon_num", { ascending: true });
  const att = (attendees ?? []) as any[];
  // 2) users 拼 profile(实名运营视图,和产品端匿名 Listener #N 互不影响)
  const userIds = att.map((a) => a.user_id);
  const { data: users } = userIds.length
    ? await svc.from("users").select("id, display_name, age, gender, ig_handle").in("id", userIds)
    : { data: [] as any[] };
  const byId = new Map(((users ?? []) as any[]).map((u) => [u.id, u]));
  // TODO(Step 2 收尾后再定): GOING 名单 CSV 导出 —— 新加 /api/export/attendees?event=,照搬 orders 导出那套。

  return (
    <div>
      {/* ---- 本场订单 ---- */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="small muted" style={{ letterSpacing: ".14em" }}>
          Event Orders <span className="green">{list.length}</span>
          {list.length === 100 ? "+" : ""}
        </div>
        <Link href={`/orders?event=${id}`} className="btn btn-sm">All Orders / Search / Export →</Link>
      </div>

      <div className="panel" style={{ padding: 0, marginBottom: 26 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>NAME</th>
              <th>DATE</th>
              <th>STATUS</th>
              <th style={{ textAlign: "right" }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="muted small">No orders yet</td>
              </tr>
            )}
            {list.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/orders/${o.id}?event=${id}`} className="green">
                    {o.attendee_name || "—"}
                  </Link>
                </td>
                <td className="muted small">
                  {new Date(o.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </td>
                <td>
                  <span className={"pill " + String(o.status)}>{String(o.status).toUpperCase()}</span>
                </td>
                <td style={{ textAlign: "right" }}>{$(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- GOING 名单 ---- */}
      <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 14 }}>
        Guest List <span className="green">{att.length}</span>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>NAME</th>
              <th>AGE / GENDER</th>
              <th>IG</th>
              <th style={{ textAlign: "right" }}>RSVP&apos;d</th>
            </tr>
          </thead>
          <tbody>
            {att.length === 0 && (
              <tr>
                <td colSpan={5} className="muted small">No guests yet</td>
              </tr>
            )}
            {att.map((a) => {
              const u = byId.get(a.user_id);
              const ageGender = [u?.age, u?.gender].filter(Boolean).join(" · ") || "—";
              return (
                <tr key={a.user_id}>
                  <td className="muted small" style={{ letterSpacing: ".1em" }}>#{a.anon_num ?? "—"}</td>
                  <td style={{ color: "var(--text)" }}>{u?.display_name || "—"}</td>
                  <td className="muted small">{ageGender}</td>
                  <td className="muted small">{u?.ig_handle ? `@${u.ig_handle}` : "—"}</td>
                  <td className="muted small" style={{ textAlign: "right" }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
