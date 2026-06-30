import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Analytics 只读漏斗聚合。全部经 analytics_funnel() RPC(无 limit 的 Postgres 聚合,
// 每层 distinct 用户;going 用 analytics_events 累计)。
// eventId=null → 全局漏斗(/analytics);传 events.id → 单场漏斗(运营中心数据分区)。
export type FunnelStage = { label: string; users: number; pct: number | null }; // pct = 相对上一参考层的转化率
export type AnalyticsData = {
  purchase: FunnelStage[]; // DETAIL VIEW → GOING → CHECKOUT START → PAID
  social: FunnelStage[]; //   GOING → POSTED MSG → SWIPED → MATCHED
  swipe: { resonate: number; pass: number };
};

const pctOf = (n: number, base: number): number | null => (base > 0 ? Math.round((n / base) * 100) : null);

export async function getAnalyticsData(svc: SupabaseClient, eventId: string | null = null): Promise<AnalyticsData> {
  const { data } = await svc.rpc("analytics_funnel", { p_event_id: eventId }).single();
  const f = (data as any) ?? {};

  // bigint 经 PostgREST 回来可能是字符串 → Number 归一
  const dv = Number(f.detail_view_users ?? 0);
  const going = Number(f.going_users ?? 0);
  const checkout = Number(f.checkout_users ?? 0);
  const paid = Number(f.paid_users ?? 0);
  const msg = Number(f.message_users ?? 0);
  const swipe = Number(f.swipe_users ?? 0);
  const match = Number(f.match_users ?? 0);

  return {
    // 购票:每层相对上一层
    purchase: [
      { label: "DETAIL VIEW", users: dv, pct: null },
      { label: "GOING", users: going, pct: pctOf(going, dv) },
      { label: "CHECKOUT START", users: checkout, pct: pctOf(checkout, going) },
      { label: "PAID", users: paid, pct: pctOf(paid, checkout) },
    ],
    // 社交 B 口径:发消息/swipe 锚定 going,match 相对 swipe
    social: [
      { label: "GOING", users: going, pct: null },
      { label: "POSTED MSG", users: msg, pct: pctOf(msg, going) },
      { label: "SWIPED", users: swipe, pct: pctOf(swipe, going) },
      { label: "MATCHED", users: match, pct: pctOf(match, swipe) },
    ],
    swipe: { resonate: Number(f.swipe_resonate ?? 0), pass: Number(f.swipe_pass ?? 0) },
  };
}
