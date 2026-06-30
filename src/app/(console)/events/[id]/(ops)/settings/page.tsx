import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import StepSettings from "../../edit/StepSettings";
import CancelButton from "../../CancelButton";

// 设置分区:基本信息入口(回向导) + 费用/结账设置(StepSettings) + 取消活动。
export default async function EventSettingsSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: ev } = await svc.from("events").select("*").eq("id", id).eq("is_owned", true).single();
  if (!ev) notFound();

  return (
    <div>
      <div className="panel" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 6 }}>基本信息</div>
          <div className="small muted">标题 · 海报 · 日期 · 地点 · 详情 —— 在创建向导里编辑</div>
        </div>
        <Link href={`/events/${id}/edit`} className="btn">编辑基本信息 →</Link>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <StepSettings event={ev} heading="费用 & 结账设置" />
      </div>

      {ev.status !== "canceled" ? (
        <div className="panel">
          <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 12 }}>DANGER ZONE</div>
          <CancelButton eventId={id} />
        </div>
      ) : (
        <p className="small muted">
          活动已取消,售卖已关闭。退款请到 ORDERS 里逐单执行(钱的事一单一单确认)。
        </p>
      )}
    </div>
  );
}
