import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

// 单活动渠道效果(只读)。走 event_channel_stats(p_event_id) RPC:
// 点击侧 = analytics_events.metadata.ref(独立访客);购票侧 = orders.channel where paid。
export type ChannelRow = { channel: string; clicks: number; purchases: number; revenueCents: number };

export async function getEventChannelStats(svc: SupabaseClient, eventId: string): Promise<ChannelRow[]> {
  const { data } = await svc.rpc("event_channel_stats", { p_event_id: eventId });
  return ((data as any[]) ?? []).map((r) => ({
    channel: r.channel,
    clicks: Number(r.clicks ?? 0),
    purchases: Number(r.purchases ?? 0),
    revenueCents: Number(r.revenue_cents ?? 0),
  }));
}
