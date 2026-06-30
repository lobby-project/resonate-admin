import type { SupabaseClient } from "@supabase/supabase-js";
import { COL_TITLE } from "@/lib/schemaMap";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Dashboard 只读聚合层。跨活动数据靠 RPC dashboard_stats()(无 limit 的 Postgres
// 聚合);即将活动 + 最近订单是普通查询。不碰任何写逻辑。
export type DashboardData = {
  revenueCents: number;
  ticketsSold: number;
  pendingOrders: number;
  upcoming: {
    id: string;
    artist: string | null;
    event_date: string | null;
    event_time: string | null;
    sold: number;
    total: number | null; // null = 有无限库存票档,不显示满格
  }[];
  recent: {
    id: string;
    status: string;
    total_cents: number;
    attendee_name: string | null;
    created_at: string;
    eventTitle: string | null;
  }[];
};

export async function getDashboardData(svc: SupabaseClient): Promise<DashboardData> {
  // LA 当地"今天"(events.event_date 是当地日期)
  const todayLA = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  const [statsRes, upcomingRes, recentRes] = await Promise.all([
    // 1+2+5:总收入 / 已售票 / 待处理 —— 无上限 Postgres 聚合
    svc.rpc("dashboard_stats").single(),
    // 3:即将到来的已发布活动(带各票档进度)
    svc
      .from("events")
      .select("id, artist, event_date, event_time, ticket_types(quantity_sold, quantity_total, is_active)")
      .eq("is_owned", true)
      .eq("status", "published")
      .eq("date_tbd", false)
      .gte("event_date", todayLA)
      .order("event_date", { ascending: true })
      .limit(20),
    // 4:最近订单 8 条
    svc
      .from("orders")
      .select(`id, status, total_cents, attendee_name, created_at, events ( ${COL_TITLE} )`)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const stats = (statsRes.data as any) ?? {};

  const upcoming = ((upcomingRes.data as any[]) ?? []).map((e) => {
    const tiers = (e.ticket_types ?? []).filter((t: any) => t.is_active);
    const sold = tiers.reduce((s: number, t: any) => s + (t.quantity_sold ?? 0), 0);
    // 任一票档无限(quantity_total = null)或没有票档 → 不给"满格"分母
    const unlimited = tiers.length === 0 || tiers.some((t: any) => t.quantity_total == null);
    const total = unlimited ? null : tiers.reduce((s: number, t: any) => s + (t.quantity_total ?? 0), 0);
    return {
      id: e.id,
      artist: e.artist,
      event_date: e.event_date,
      event_time: e.event_time,
      sold,
      total,
    };
  });

  const recent = ((recentRes.data as any[]) ?? []).map((o) => ({
    id: o.id,
    status: o.status,
    total_cents: o.total_cents,
    attendee_name: o.attendee_name,
    created_at: o.created_at,
    eventTitle: o.events?.[COL_TITLE] ?? null,
  }));

  return {
    // bigint 经 PostgREST 回来可能是字符串 → Number 归一
    revenueCents: Number(stats.revenue_cents ?? 0),
    ticketsSold: Number(stats.tickets_sold ?? 0),
    pendingOrders: Number(stats.pending_orders ?? 0),
    upcoming,
    recent,
  };
}
