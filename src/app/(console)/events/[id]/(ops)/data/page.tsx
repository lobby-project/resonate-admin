import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAnalyticsData } from "@/app/(console)/analytics/data";
import Funnel from "@/app/(console)/analytics/Funnel";
import ChannelLinkBuilder from "../../ChannelLinkBuilder";
import { getEventChannelStats } from "../../data";

const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

// 数据分区:单场漏斗(购票 + 社交,复用 /analytics 的 Funnel + RPC)+ 渠道归因。
export default async function EventDataSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: ev } = await svc.from("events").select("id").eq("id", id).eq("is_owned", true).single();
  if (!ev) notFound();

  // 单场漏斗:同一个 analytics_funnel RPC,传 eventId(全局仍传 null,互不影响)。
  const funnels = await getAnalyticsData(svc, id);
  const channels = await getEventChannelStats(svc, id);

  return (
    <div>
      <div className="funnel-grid" style={{ marginBottom: 18 }}>
        <Funnel title="PURCHASE FUNNEL" stages={funnels.purchase} />
        <Funnel
          title="SOCIAL FUNNEL"
          stages={funnels.social}
          footer={
            <div className="small muted" style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              SWIPES: <span className="green">{funnels.swipe.resonate.toLocaleString()}</span> ♥ resonate · {funnels.swipe.pass.toLocaleString()} ✕ pass
            </div>
          }
        />
      </div>

      <ChannelLinkBuilder eventId={id} />

      <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 10 }}>CHANNEL PERFORMANCE</div>
      <div className="panel" style={{ padding: 0, marginBottom: 18 }}>
        {channels.length === 0 ? (
          <div className="small muted" style={{ padding: 20 }}>No channel data yet — once channel links get clicks or sales</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>CHANNEL</th>
                <th style={{ textAlign: "right" }}>CLICKS</th>
                <th style={{ textAlign: "right" }}>PURCHASES</th>
                <th style={{ textAlign: "right" }}>REVENUE</th>
                <th style={{ textAlign: "right" }}>CONV%</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => {
                const conv = c.clicks > 0 ? Math.round((c.purchases / c.clicks) * 100) : null;
                return (
                  <tr key={c.channel}>
                    <td className="green">{c.channel}</td>
                    <td style={{ textAlign: "right" }}>{c.clicks.toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>{c.purchases.toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>{$(c.revenueCents)}</td>
                    <td className="muted" style={{ textAlign: "right" }}>{conv != null ? `${conv}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
