import { requireAdmin } from "@/lib/auth";
import { getAnalyticsData } from "./data";
import Funnel from "./Funnel";

// ANALYTICS — 全局购票漏斗 + 社交漏斗(第二期只做全局)。只读聚合。
export default async function AnalyticsPage() {
  const { svc } = await requireAdmin();
  const d = await getAnalyticsData(svc);

  return (
    <div>
      <div className="page-h">
        <h1>ANALYTICS</h1>
        <span className="small muted">GLOBAL · ALL EVENTS</span>
      </div>

      <div className="funnel-grid">
        <Funnel title="PURCHASE FUNNEL" stages={d.purchase} />
        <Funnel
          title="SOCIAL FUNNEL"
          stages={d.social}
          footer={
            <div className="small muted" style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              SWIPES: <span className="green">{d.swipe.resonate.toLocaleString()}</span> ♥ resonate · {d.swipe.pass.toLocaleString()} ✕ pass
            </div>
          }
        />
      </div>
    </div>
  );
}
