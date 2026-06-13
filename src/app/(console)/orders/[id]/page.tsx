import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { COL_TITLE } from "@/lib/schemaMap";
import RefundButton from "./RefundButton";

/* eslint-disable @typescript-eslint/no-explicit-any */
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: order } = await svc
    .from("orders")
    .select(`*, events ( ${COL_TITLE} )`)
    .eq("id", id)
    .single();
  if (!order) notFound();

  const [{ data: tickets }, { data: u }] = await Promise.all([
    svc.from("tickets").select("code, status, ticket_types ( name )").eq("order_id", id),
    svc.auth.admin.getUserById(order.user_id),
  ]);

  const o = order as any;
  return (
    <div>
      <div className="page-h">
        <h1>ORDER <span className="small muted">{id.slice(0, 8)}…</span></h1>
        <span className={"badge " + (o.status === "paid" ? "live" : "")}>{o.status.toUpperCase()}</span>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 12 }}>BUYER</div>
        <div style={{ color: "#fff", marginBottom: 4 }}>{o.attendee_name || "—"}</div>
        <div className="small muted">
          {u?.user?.email ?? "邮箱未知"}
          {o.attendee_phone ? ` · ${o.attendee_phone}` : ""}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 12 }}>
          {o.events?.[COL_TITLE] ?? "—"} · {new Date(o.created_at).toLocaleString()}
        </div>
        <table className="tbl">
          <tbody>
            <tr><td className="muted">Subtotal</td><td style={{ textAlign: "right" }}>{$(o.subtotal_cents)}</td></tr>
            {o.discount_cents > 0 && (
              <tr><td className="muted">Discount</td><td style={{ textAlign: "right" }}>−{$(o.discount_cents)}</td></tr>
            )}
            {o.fee_cents > 0 && (
              <tr><td className="muted">{o.fee_name ?? "Fee"}</td><td style={{ textAlign: "right" }}>{$(o.fee_cents)}</td></tr>
            )}
            <tr><td style={{ color: "#fff" }}>Total</td><td style={{ textAlign: "right", color: "#39FF14" }}>{$(o.total_cents)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 12 }}>TICKETS</div>
        {(tickets ?? []).map((t: any) => (
          <div key={t.code} className="small" style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #161616" }}>
            <span style={{ color: "#fff", letterSpacing: ".12em" }}>{t.code}</span>
            <span className="muted">{t.ticket_types?.name} · {t.status}</span>
          </div>
        ))}
      </div>

      {o.status === "paid" && <RefundButton orderId={id} total={$(o.total_cents)} />}
      {o.status === "refunded" && <p className="small muted">已退款。票已作废,库存已回补。</p>}
    </div>
  );
}
