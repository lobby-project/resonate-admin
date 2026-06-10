"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

// ⚠️ events 既有列的映射在 src/lib/schemaMap.ts —— Claude Code 核对那一个文件即可
import { COL_TITLE, COL_VENUE, COL_LAT, COL_LNG, TBD_DATE_SENTINEL } from "@/lib/schemaMap";

/* ---------------- 草稿 ---------------- */

export async function createDraftAndRedirect() {
  const { user, svc } = await requireAdmin();
  const { data, error } = await svc
    .from("events")
    .insert({
      [COL_TITLE]: "UNTITLED EVENT",
      is_owned: true,
      status: "draft",
      event_type: "ticketed",
      date_tbd: true,
      event_date: TBD_DATE_SENTINEL,
      location_type: "physical",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/events/${data.id}/edit`);
}

/* ---------------- 分步保存(自动草稿) ----------------
   patch 白名单:只允许向导各步的字段,防止误写聚合管线的列 */
const EVENT_WRITABLE = new Set([
  "event_type",
  COL_TITLE,
  "teaser",
  "poster_url",
  "genre",
  "date_tbd",
  "event_date",
  "end_date",
  "timezone",
  "location_type",
  COL_VENUE,
  "address",
  "online_url",
  "details",
  "rsvp_capacity",
  "fee_name",
  "fee_percent",
  "sales_open",
  "ticket_limit_per_order",
  "soldout_message",
  "closed_message",
  "refund_policy",
  "collect_phone",
]);

export async function saveEvent(eventId: string, patch: Record<string, unknown>) {
  const { svc } = await requireAdmin();
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (EVENT_WRITABLE.has(k)) clean[k] = v;
  }
  // TBD 状态下保证 event_date 不为空(兼容 NOT NULL 约束)
  if (clean["date_tbd"] === true && !clean["event_date"]) {
    clean["event_date"] = TBD_DATE_SENTINEL;
  }
  const { error } = await svc.from("events").update(clean).eq("id", eventId).eq("is_owned", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events/${eventId}/edit`);
  return { ok: true };
}

/* ---------------- Geocode(复用主项目同款 Google API) ---------------- */

export async function geocodeAddress(address: string) {
  await requireAdmin();
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) return { ok: false as const, error: "GOOGLE_GEOCODING_API_KEY 未配置" };
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  );
  const json = await res.json();
  const loc = json?.results?.[0]?.geometry?.location;
  if (!loc) return { ok: false as const, error: "地址没有解析出坐标,检查拼写" };
  return { ok: true as const, lat: loc.lat as number, lng: loc.lng as number };
}

/* ---------------- 发布 ---------------- */

export async function publishEvent(eventId: string) {
  const { svc } = await requireAdmin();
  const { data: ev, error: loadErr } = await svc
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("is_owned", true)
    .single();
  if (loadErr || !ev) return { ok: false, errors: ["活动不存在"] };

  const errors: string[] = [];
  const title = ev[COL_TITLE];
  if (!title || title === "UNTITLED EVENT") errors.push("INFO:标题还没填");
  if (!ev.poster_url) errors.push("INFO:海报必传(1:1 或 9:16)");
  if (!ev.date_tbd && (!ev.event_date || ev.event_date === TBD_DATE_SENTINEL))
    errors.push("DATE&TIME:不是 TBD 就必须有开始时间");
  if (ev.location_type === "physical" && !ev.address) errors.push("LOCATION:实体活动要有地址");
  if (ev.location_type === "online" && !ev.online_url) errors.push("LOCATION:线上活动要有链接");

  if (ev.event_type === "ticketed") {
    const { count } = await svc
      .from("ticket_types")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_active", true);
    if (!count) errors.push("TICKETS:至少要有一个票档(RSVP 活动请回第一步改类型)");
  }

  // 实体地址 → 自动 geocode 进坐标体系(已有坐标就不重复打)
  if (ev.location_type === "physical" && ev.address && (ev[COL_LAT] == null || ev[COL_LNG] == null)) {
    const g = await geocodeAddress(`${ev[COL_VENUE] ?? ""} ${ev.address}`.trim());
    if (g.ok) {
      await svc
        .from("events")
        .update({ [COL_LAT]: g.lat, [COL_LNG]: g.lng })
        .eq("id", eventId);
    } else {
      errors.push(`LOCATION:坐标解析失败(${g.error})`);
    }
  }

  if (errors.length) return { ok: false, errors };

  const { error } = await svc.from("events").update({ status: "published" }).eq("id", eventId);
  if (error) return { ok: false, errors: [error.message] };
  revalidatePath(`/events/${eventId}/edit`);
  revalidatePath("/");
  return { ok: true, errors: [] };
}

export async function unpublishEvent(eventId: string) {
  const { svc } = await requireAdmin();
  await svc.from("events").update({ status: "draft" }).eq("id", eventId).eq("is_owned", true);
  revalidatePath(`/events/${eventId}/edit`);
  revalidatePath("/");
  return { ok: true };
}

/* ---------------- 票档 CRUD ---------------- */

export type TierInput = {
  id?: string;
  name: string;
  description: string | null;
  pricing_method: "fixed" | "pwyw" | "free";
  price_cents: number | null;
  min_price_cents: number | null;
  quantity_total: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_visible: boolean;
  ticket_note: string | null;
  sort_order: number;
};

export async function upsertTier(eventId: string, tier: TierInput) {
  const { svc } = await requireAdmin();
  const row = { ...tier, event_id: eventId, is_active: true };
  const { error } = tier.id
    ? await svc.from("ticket_types").update(row).eq("id", tier.id)
    : await svc.from("ticket_types").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events/${eventId}/edit`);
  return { ok: true };
}

export async function deleteTier(eventId: string, tierId: string) {
  const { svc } = await requireAdmin();
  // 软删:已经有售出记录的票档不能真删
  const { error } = await svc.from("ticket_types").update({ is_active: false }).eq("id", tierId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events/${eventId}/edit`);
  return { ok: true };
}

/* ---------------- 折扣码 CRUD ---------------- */

export type CodeInput = {
  id?: string;
  code: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  max_uses: number | null;
  expires_at: string | null;
  scope_event: boolean; // true=只绑这场活动, false=全场通用
};

export async function upsertCode(eventId: string, input: CodeInput) {
  const { svc } = await requireAdmin();
  const row = {
    code: input.code.trim().toUpperCase(),
    percent_off: input.percent_off,
    amount_off_cents: input.amount_off_cents,
    max_uses: input.max_uses,
    expires_at: input.expires_at,
    event_id: input.scope_event ? eventId : null,
    is_active: true,
  };
  const { error } = input.id
    ? await svc.from("discount_codes").update(row).eq("id", input.id)
    : await svc.from("discount_codes").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events/${eventId}/edit`);
  return { ok: true };
}

export async function deactivateCode(eventId: string, codeId: string) {
  const { svc } = await requireAdmin();
  const { error } = await svc.from("discount_codes").update({ is_active: false }).eq("id", codeId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/events/${eventId}/edit`);
  return { ok: true };
}
