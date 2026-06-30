"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEvent, publishEvent, unpublishEvent } from "../../actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StepSettings({ event, heading = "STEP 7 / 7 — SETTINGS" }: { event: any; heading?: string }) {
  const [s, setS] = useState({
    fee_name: event.fee_name ?? "Processing",
    fee_percent: event.fee_percent ?? 15,
    sales_open: event.sales_open ?? true,
    ticket_limit_per_order: event.ticket_limit_per_order ?? 8,
    collect_phone: event.collect_phone ?? false,
    soldout_message: event.soldout_message ?? "Tickets are sold out. See other events.",
    closed_message: event.closed_message ?? "Sales are closed. See other events.",
    refund_policy: event.refund_policy ?? "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (k: string, v: unknown) => setS((p) => ({ ...p, [k]: v }));

  function persist(then?: () => void) {
    start(async () => {
      const r = await saveEvent(event.id, s);
      if (!r.ok) {
        setErrors([r.error ?? "保存失败"]);
        return;
      }
      setErrors([]);
      then?.();
    });
  }

  function doPublish() {
    persist(() =>
      start(async () => {
        const r = await publishEvent(event.id);
        if (!r.ok) {
          setErrors(r.errors);
          setOkMsg(null);
          return;
        }
        setErrors([]);
        setOkMsg("已发布——产品端 R◉SELECTED 货架立刻可见(T2 上线后)");
        router.refresh();
      })
    );
  }

  const isTicketed = event.event_type === "ticketed";

  return (
    <div>
      <h2 className="small muted" style={{ letterSpacing: ".16em", marginBottom: 18 }}>
        {heading}
      </h2>

      {isTicketed && (
        <>
          <div className="small muted" style={{ letterSpacing: ".12em", marginBottom: 10 }}>
            BUYER FEE(向买家加收,结账单列一行;名目别叫 Tax)
          </div>
          <div className="row2" style={{ maxWidth: 480 }}>
            <div className="field">
              <label>Fee name</label>
              <input type="text" value={s.fee_name} onChange={(e) => set("fee_name", e.target.value)} />
            </div>
            <div className="field">
              <label>Fee %</label>
              <input
                type="number" min={0} max={50} step={0.5}
                value={s.fee_percent}
                onChange={(e) => set("fee_percent", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="hint" style={{ marginBottom: 18 }}>
            示例:$25 票 + {s.fee_percent}% {s.fee_name} = 买家付 ${(25 * (1 + Number(s.fee_percent) / 100)).toFixed(2)}
          </div>
        </>
      )}

      <div className="small muted" style={{ letterSpacing: ".12em", marginBottom: 10 }}>
        CHECKOUT
      </div>
      <div className="field">
        <label className="toggle" style={{ textTransform: "none" }}>
          <input type="checkbox" checked={s.sales_open} onChange={(e) => set("sales_open", e.target.checked)} />
          {isTicketed ? "售票开启(关掉=暂停售卖)" : "RSVP 开启"}
        </label>
      </div>
      <div className="row2" style={{ maxWidth: 480 }}>
        <div className="field">
          <label>每单限购</label>
          <input
            type="number" min={1} max={50}
            value={s.ticket_limit_per_order}
            onChange={(e) => set("ticket_limit_per_order", Number(e.target.value))}
          />
        </div>
        <div className="field" style={{ display: "flex", alignItems: "flex-end", paddingBottom: 12 }}>
          <label className="toggle" style={{ textTransform: "none" }}>
            <input type="checkbox" checked={s.collect_phone} onChange={(e) => set("collect_phone", e.target.checked)} />
            结账收电话号
          </label>
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>售罄提示文案</label>
          <input type="text" value={s.soldout_message} onChange={(e) => set("soldout_message", e.target.value)} />
        </div>
        <div className="field">
          <label>关闭提示文案</label>
          <input type="text" value={s.closed_message} onChange={(e) => set("closed_message", e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Refund policy(显示在购票页)</label>
        <textarea
          value={s.refund_policy}
          placeholder="All sales final. / 演出前 48 小时可全额退款…"
          onChange={(e) => set("refund_policy", e.target.value)}
        />
      </div>

      <p className="hint small muted" style={{ marginBottom: 18 }}>
        确认/提醒/取消邮件三件套在 T3/T4 接入(Resend),发布不受影响。
      </p>

      {errors.length > 0 && (
        <div className="err">
          {errors.map((e, i) => (
            <div key={i}>· {e}</div>
          ))}
        </div>
      )}
      {okMsg && <div className="ok-msg" style={{ marginBottom: 14 }}>{okMsg}</div>}

      <div className="wiz-foot">
        <button className="btn" onClick={() => persist()} disabled={pending}>
          {pending ? "SAVING…" : "SAVE SETTINGS"}
        </button>
        {event.status === "published" ? (
          <button
            className="btn-danger"
            disabled={pending}
            onClick={() => start(async () => { await unpublishEvent(event.id); router.refresh(); })}
          >
            UNPUBLISH → DRAFT
          </button>
        ) : (
          <button className="btn-green" onClick={doPublish} disabled={pending}>
            {pending ? "…" : "PUBLISH EVENT"}
          </button>
        )}
      </div>
    </div>
  );
}
