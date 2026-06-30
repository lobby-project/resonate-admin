import type { FunnelStage } from "./data";

// 一条漏斗:每行 层名 + 横条(宽度 = 本层/首层,漏斗形)+ 人数 + 转化%
// 全局 /analytics 和单场运营中心数据分区共用同一个组件。
export default function Funnel({
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
