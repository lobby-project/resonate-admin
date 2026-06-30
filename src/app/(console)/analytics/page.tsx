import { requireAdmin } from "@/lib/auth";
import { getAnalyticsData, type FunnelStage } from "./data";

// 一条漏斗:每行 层名 + 横条(宽度 = 本层/首层,漏斗形)+ 人数 + 转化%
function Funnel({
  title,
  stages,
  footer,
}: {
  title: string;
  stages: FunnelStage[];
  footer?: React.ReactNode;
}) {
  const first = stages[0]?.users || 0;
  return (
    <div className="panel">
      <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 16 }}>{title}</div>
      {stages.map((s) => {
        const w = first > 0 ? Math.round((s.users / first) * 100) : 0;
        return (
          <div key={s.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <span className="small" style={{ color: "#fff", letterSpacing: ".08em" }}>{s.label}</span>
              <span className="small muted">
                <span className="green" style={{ fontSize: 14 }}>{s.users.toLocaleString()}</span>
                {s.pct != null && <span style={{ marginLeft: 8 }}>{s.pct}%</span>}
              </span>
            </div>
            <div className="bar"><div className="bar-in" style={{ width: `${w}%` }} /></div>
          </div>
        );
      })}
      {footer}
    </div>
  );
}

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
