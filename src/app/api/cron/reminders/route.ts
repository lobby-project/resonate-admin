import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { COL_TITLE, COL_VENUE } from "@/lib/schemaMap";
import { sendReminderEmail } from "@/lib/email";

/* eslint-disable @typescript-eslint/no-explicit-any */

// 每日提醒邮件:未来 26 小时内开演、已发布、未发过提醒的自办活动
// → 给所有有效票持有人发"明天见"。鉴权与主项目 Cron 同款:Bearer 或 ?secret=
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const ok =
    (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.CRON_SECRET && url.searchParams.get("secret") === process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + 26 * 3600_000);

  const { data: events } = await svc
    .from("events")
    .select(`id, ${COL_TITLE}, ${COL_VENUE}, event_date`)
    .eq("is_owned", true)
    .eq("status", "published")
    .eq("date_tbd", false)
    .is("reminder_sent_at", null)
    .gte("event_date", now.toISOString())
    .lte("event_date", horizon.toISOString());

  let totalSent = 0;
  for (const ev of (events ?? []) as any[]) {
    const { data: tks } = await svc
      .from("tickets")
      .select("user_id")
      .eq("event_id", ev.id)
      .eq("status", "valid");
    const userIds = [...new Set((tks ?? []).map((t) => t.user_id))];
    for (const uid of userIds) {
      try {
        const { data: u } = await svc.auth.admin.getUserById(uid);
        if (u?.user?.email) {
          const sent = await sendReminderEmail(u.user.email, ev[COL_TITLE], ev.event_date, ev[COL_VENUE]);
          if (sent) totalSent++;
        }
      } catch (e) {
        console.error("[reminder] uid=", uid, e);
      }
    }
    await svc.from("events").update({ reminder_sent_at: new Date().toISOString() }).eq("id", ev.id);
  }

  return NextResponse.json({ events: (events ?? []).length, sent: totalSent });
}
