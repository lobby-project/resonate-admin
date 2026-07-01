"use server";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { COL_TITLE } from "@/lib/schemaMap";
import { sendCancelEmail, sendRefundEmail } from "@/lib/email";

/* ============================================================
   退款(整单,beta 不做部分退款):
   Stripe 退款 → 订单 refunded → 票全部 refunded → 票档库存回补
   → 撤销自动 going → 退款邮件(尽力而为)
   ============================================================ */
export async function refundOrder(orderId: string) {
  const { svc } = await requireAdmin();

  const { data: order } = await svc.from("orders").select("*").eq("id", orderId).single();
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status !== "paid") return { ok: false, error: `Only paid orders can be refunded; current status is ${order.status}` };

  // Stripe 退款(免费单没有 payment_intent,跳过 Stripe 直接走库内退)
  if (order.stripe_payment_intent) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      await stripe.refunds.create({ payment_intent: order.stripe_payment_intent });
    } catch (e) {
      return { ok: false, error: `Stripe refund failed: ${(e as Error).message}` };
    }
  }

  await svc.from("orders").update({ status: "refunded" }).eq("id", orderId);

  // 票作废 + 按票档回补库存
  const { data: tks } = await svc.from("tickets").select("id, ticket_type_id").eq("order_id", orderId);
  await svc.from("tickets").update({ status: "refunded" }).eq("order_id", orderId);
  const byTier = new Map<string, number>();
  for (const t of tks ?? []) {
    if (t.ticket_type_id) byTier.set(t.ticket_type_id, (byTier.get(t.ticket_type_id) ?? 0) + 1);
  }
  for (const [tierId, n] of byTier) {
    const { data: tt } = await svc.from("ticket_types").select("quantity_sold").eq("id", tierId).single();
    if (tt) {
      await svc
        .from("ticket_types")
        .update({ quantity_sold: Math.max(0, tt.quantity_sold - n) })
        .eq("id", tierId);
    }
  }

  // 撤销这单带来的自动 going(若该用户在这场已无其他有效票)
  const { count: stillValid } = await svc
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", order.event_id)
    .eq("user_id", order.user_id)
    .eq("status", "valid");
  if (!stillValid) {
    await svc.from("event_attendees").delete().eq("event_id", order.event_id).eq("user_id", order.user_id);
  }

  // 退款邮件(失败不影响退款结果)
  try {
    const [{ data: ev }, { data: u }] = await Promise.all([
      svc.from("events").select(`${COL_TITLE}`).eq("id", order.event_id).single(),
      svc.auth.admin.getUserById(order.user_id),
    ]);
    const email = u?.user?.email;
    if (email && ev) {
      await sendRefundEmail(email, (ev as Record<string, string>)[COL_TITLE] ?? "Your event", order.total_cents);
    }
  } catch (e) {
    console.error("[refund] 邮件环节异常(已忽略):", e);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

/* ============================================================
   取消活动:status=canceled + 停售 + 群发取消通知
   (退款仍逐单执行——beta 不做一键全退,钱的事一单一单确认)
   ============================================================ */
export async function cancelEvent(eventId: string) {
  const { svc } = await requireAdmin();

  const { data: ev } = await svc
    .from("events")
    .select(`id, status, ${COL_TITLE}, event_date`)
    .eq("id", eventId)
    .eq("is_owned", true)
    .single();
  if (!ev) return { ok: false, error: "Event not found" };
  if (ev.status === "canceled") return { ok: false, error: "Event is already canceled" };

  await svc.from("events").update({ status: "canceled", sales_open: false }).eq("id", eventId);

  // 群发取消通知:有效票持有人(去重 user)
  const { data: tks } = await svc
    .from("tickets")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("status", "valid");
  const userIds = [...new Set((tks ?? []).map((t) => t.user_id))];
  let sent = 0;
  for (const uid of userIds) {
    try {
      const { data: u } = await svc.auth.admin.getUserById(uid);
      const email = u?.user?.email;
      if (email) {
        const ok = await sendCancelEmail(
          email,
          (ev as unknown as Record<string, string>)[COL_TITLE] ?? "Your event",
          (ev as { event_date: string | null }).event_date
        );
        if (ok) sent++;
      }
    } catch (e) {
      console.error("[cancel] 通知失败 uid=", uid, e);
    }
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events"); // 活动列表(取消后从这刷)
  revalidatePath("/"); // Dashboard(即将活动/计数受影响)
  return { ok: true, notified: sent, holders: userIds.length };
}
