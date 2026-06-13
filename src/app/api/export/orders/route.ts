import { requireAdmin } from "@/lib/auth";
import { COL_TITLE } from "@/lib/schemaMap";

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/export/orders?event=&status= — 订单 CSV 导出(对账用)
const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  let svc;
  try {
    ({ svc } = await requireAdmin());
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const event = url.searchParams.get("event");
  const status = url.searchParams.get("status");

  let q = svc
    .from("orders")
    .select(
      `id, created_at, paid_at, status, attendee_name, attendee_phone,
       subtotal_cents, discount_cents, fee_name, fee_cents, total_cents,
       stripe_session_id, events ( ${COL_TITLE} )`
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  if (event) q = q.eq("event_id", event);
  if (status) q = q.eq("status", status);
  const { data: orders } = await q;

  const header = [
    "order_id", "created_at", "paid_at", "status", "event", "attendee_name", "attendee_phone",
    "subtotal_usd", "discount_usd", "fee_name", "fee_usd", "total_usd", "stripe_session",
  ].join(",");
  const rows = ((orders ?? []) as any[]).map((o) =>
    [
      o.id, o.created_at, o.paid_at ?? "", o.status, o.events?.[COL_TITLE] ?? "",
      o.attendee_name ?? "", o.attendee_phone ?? "",
      (o.subtotal_cents / 100).toFixed(2), (o.discount_cents / 100).toFixed(2),
      o.fee_name ?? "", (o.fee_cents / 100).toFixed(2), (o.total_cents / 100).toFixed(2),
      o.stripe_session_id ?? "",
    ].map(esc).join(",")
  );
  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resonate-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
