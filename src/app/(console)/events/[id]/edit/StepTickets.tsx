"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEvent, upsertTier, deleteTier, upsertCode, deactivateCode, type TierInput, type CodeInput } from "../../actions";
import { DEFAULT_TICKET_NOTE } from "@/lib/schemaMap";

/* eslint-disable @typescript-eslint/no-explicit-any */

const $ = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(2)}`);
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

const EMPTY_TIER: TierInput = {
  name: "",
  description: null,
  pricing_method: "fixed",
  price_cents: null,
  min_price_cents: null,
  quantity_total: null,
  sale_starts_at: null,
  sale_ends_at: null,
  is_visible: true,
  ticket_note: DEFAULT_TICKET_NOTE,
  sort_order: 0,
};

export default function StepTickets({ event, tiers, codes }: { event: any; tiers: any[]; codes: any[] }) {
  const isRsvp = event.event_type === "rsvp";
  return (
    <div>
      <h2 className="small muted" style={{ letterSpacing: ".16em", marginBottom: 18 }}>
        STEP 6 / 7 — {isRsvp ? "RSVP" : "TICKETS"}
      </h2>
      {isRsvp ? <RsvpPanel event={event} /> : <TiersPanel event={event} tiers={tiers} />}
      <div style={{ borderTop: "1px dashed var(--border)", marginTop: 24, paddingTop: 20 }}>
        <CodesPanel event={event} codes={codes} />
      </div>
    </div>
  );
}

/* ---------------- RSVP 容量 ---------------- */
function RsvpPanel({ event }: { event: any }) {
  const [cap, setCap] = useState<string>(event.rsvp_capacity ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label>RSVP capacity (空 = 不限)</label>
        <input type="number" value={cap} min={1} onChange={(e) => setCap(e.target.value)} />
      </div>
      <button
        className="btn btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await saveEvent(event.id, { rsvp_capacity: cap ? Number(cap) : null });
            router.refresh();
          })
        }
      >
        {pending ? "SAVING…" : "SAVE CAPACITY"}
      </button>
    </div>
  );
}

/* ---------------- 票档 ---------------- */
function TiersPanel({ event, tiers }: { event: any; tiers: any[] }) {
  const [editing, setEditing] = useState<TierInput | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function save() {
    if (!editing) return;
    if (!editing.name.trim()) return setErr("票名必填");
    if (editing.pricing_method === "fixed" && (editing.price_cents == null || editing.price_cents <= 0))
      return setErr("Fixed 票要有价格");
    setErr(null);
    start(async () => {
      const r = await upsertTier(event.id, { ...editing, sort_order: editing.sort_order ?? tiers.length });
      if (!r.ok) return setErr(r.error ?? "保存失败");
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div>
      {tiers.map((t) =>
        editing?.id === t.id ? (
          <TierForm key={t.id} tier={editing!} setTier={setEditing as any} onSave={save} onCancel={() => setEditing(null)} pending={pending} err={err} />
        ) : (
          <div className="tier" key={t.id}>
            <div className="tier-h">
              <span className="t-name">
                {t.name} {!t.is_visible && <span className="badge draft" style={{ marginLeft: 8 }}>HIDDEN</span>}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    setEditing({
                      id: t.id,
                      name: t.name,
                      description: t.description,
                      pricing_method: t.pricing_method,
                      price_cents: t.price_cents,
                      min_price_cents: t.min_price_cents,
                      quantity_total: t.quantity_total,
                      sale_starts_at: t.sale_starts_at,
                      sale_ends_at: t.sale_ends_at,
                      is_visible: t.is_visible,
                      ticket_note: t.ticket_note,
                      sort_order: t.sort_order,
                    })
                  }
                >
                  EDIT
                </button>
                <button
                  className="btn-danger btn-sm"
                  onClick={() => start(async () => { await deleteTier(event.id, t.id); router.refresh(); })}
                >
                  REMOVE
                </button>
              </div>
            </div>
            <div className="tier-meta">
              <span>
                {t.pricing_method === "free" ? "FREE" : t.pricing_method === "pwyw" ? `PWYW(min ${$(t.min_price_cents ?? 0)})` : $(t.price_cents)}
              </span>
              <span>{t.quantity_total == null ? "不限量" : `${t.quantity_sold}/${t.quantity_total} 已售`}</span>
              {t.sale_ends_at && <span>停售 {new Date(t.sale_ends_at).toLocaleString()}</span>}
            </div>
          </div>
        )
      )}
      {editing && !editing.id && (
        <TierForm tier={editing} setTier={setEditing as any} onSave={save} onCancel={() => setEditing(null)} pending={pending} err={err} />
      )}
      {!editing && (
        <button className="btn" onClick={() => setEditing({ ...EMPTY_TIER, sort_order: tiers.length })}>
          + ADD TIER
        </button>
      )}
      <p className="hint small muted" style={{ marginTop: 12 }}>
        早鸟票 = 一个设了停售时间的票档。嘉宾/内部票 = 一个 HIDDEN 票档 + 专属折扣码。
      </p>
    </div>
  );
}

function TierForm({
  tier, setTier, onSave, onCancel, pending, err,
}: {
  tier: TierInput;
  setTier: (t: TierInput) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  err: string | null;
}) {
  const s = (k: keyof TierInput, v: unknown) => setTier({ ...tier, [k]: v } as TierInput);
  return (
    <div className="tier editing">
      {err && <div className="err">{err}</div>}
      <div className="row2">
        <div className="field">
          <label>Ticket name *</label>
          <input type="text" value={tier.name} placeholder="General Admission" onChange={(e) => s("name", e.target.value)} />
        </div>
        <div className="field">
          <label>Pricing</label>
          <select value={tier.pricing_method} onChange={(e) => s("pricing_method", e.target.value)}>
            <option value="fixed">Fixed price</option>
            <option value="pwyw">Pay what you want</option>
            <option value="free">Free</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Description (optional · 显示在购票页)</label>
        <input type="text" value={tier.description ?? ""} placeholder="含后台通行 + 免费饮品" onChange={(e) => s("description", e.target.value || null)} />
      </div>
      <div className="row3">
        {tier.pricing_method === "fixed" && (
          <div className="field">
            <label>Price (USD)</label>
            <input
              type="number" min={0.5} step={0.01}
              value={tier.price_cents == null ? "" : tier.price_cents / 100}
              onChange={(e) => s("price_cents", e.target.value ? Math.round(Number(e.target.value) * 100) : null)}
            />
          </div>
        )}
        {tier.pricing_method === "pwyw" && (
          <div className="field">
            <label>Min price (USD · 可0)</label>
            <input
              type="number" min={0} step={0.01}
              value={tier.min_price_cents == null ? "" : tier.min_price_cents / 100}
              onChange={(e) => s("min_price_cents", e.target.value ? Math.round(Number(e.target.value) * 100) : 0)}
            />
          </div>
        )}
        <div className="field">
          <label>Quantity (空=不限)</label>
          <input
            type="number" min={1}
            value={tier.quantity_total ?? ""}
            onChange={(e) => s("quantity_total", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div className="field">
          <label>Visibility</label>
          <select value={tier.is_visible ? "show" : "hide"} onChange={(e) => s("is_visible", e.target.value === "show")}>
            <option value="show">Show ticket</option>
            <option value="hide">Hide ticket</option>
          </select>
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>Sale starts (空=立即)</label>
          <input type="datetime-local" value={toLocal(tier.sale_starts_at)} onChange={(e) => s("sale_starts_at", fromLocal(e.target.value))} />
        </div>
        <div className="field">
          <label>Sale ends (空=随活动 · 早鸟在这设截止)</label>
          <input type="datetime-local" value={toLocal(tier.sale_ends_at)} onChange={(e) => s("sale_ends_at", fromLocal(e.target.value))} />
        </div>
      </div>
      <div className="field">
        <label>Ticket note (印在电子票底部)</label>
        <textarea value={tier.ticket_note ?? ""} onChange={(e) => s("ticket_note", e.target.value || null)} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-sm" onClick={onCancel}>CANCEL</button>
        <button className="btn-green btn-sm" onClick={onSave} disabled={pending}>
          {pending ? "SAVING…" : tier.id ? "SAVE TIER" : "CREATE TIER"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- 折扣码 ---------------- */
const EMPTY_CODE: CodeInput = { code: "", percent_off: null, amount_off_cents: null, max_uses: null, expires_at: null, scope_event: true };

function CodesPanel({ event, codes }: { event: any; codes: any[] }) {
  const [editing, setEditing] = useState<CodeInput | null>(null);
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function save() {
    if (!editing) return;
    if (!editing.code.trim()) return setErr("码必填");
    if (mode === "percent" && !editing.percent_off) return setErr("百分比必填");
    if (mode === "amount" && !editing.amount_off_cents) return setErr("减免金额必填");
    setErr(null);
    start(async () => {
      const payload = { ...editing, percent_off: mode === "percent" ? editing.percent_off : null, amount_off_cents: mode === "amount" ? editing.amount_off_cents : null };
      const r = await upsertCode(event.id, payload);
      if (!r.ok) return setErr(r.error ?? "保存失败");
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 12 }}>
        DISCOUNT CODES
      </div>
      {codes.map((c) => (
        <div className="tier" key={c.id}>
          <div className="tier-h">
            <span className="t-name green">{c.code}</span>
            <button className="btn-danger btn-sm" onClick={() => start(async () => { await deactivateCode(event.id, c.id); router.refresh(); })}>
              DEACTIVATE
            </button>
          </div>
          <div className="tier-meta">
            <span>{c.percent_off ? `-${c.percent_off}%` : `-${$(c.amount_off_cents)}`}</span>
            <span>{c.event_id ? "只限本场" : "全场通用"}</span>
            <span>{c.max_uses ? `${c.used_count}/${c.max_uses} 已用` : "不限次数"}</span>
            {c.expires_at && <span>过期 {new Date(c.expires_at).toLocaleDateString()}</span>}
          </div>
        </div>
      ))}
      {editing ? (
        <div className="tier editing">
          {err && <div className="err">{err}</div>}
          <div className="row3">
            <div className="field">
              <label>Code *</label>
              <input type="text" value={editing.code} placeholder="GUEST2026" onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as "percent" | "amount")}>
                <option value="percent">% off</option>
                <option value="amount">$ off</option>
              </select>
            </div>
            <div className="field">
              <label>{mode === "percent" ? "% off (1-100)" : "$ off"}</label>
              {mode === "percent" ? (
                <input type="number" min={1} max={100} value={editing.percent_off ?? ""} onChange={(e) => setEditing({ ...editing, percent_off: e.target.value ? Number(e.target.value) : null })} />
              ) : (
                <input type="number" min={0.01} step={0.01} value={editing.amount_off_cents == null ? "" : editing.amount_off_cents / 100} onChange={(e) => setEditing({ ...editing, amount_off_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : null })} />
              )}
            </div>
          </div>
          <div className="row3">
            <div className="field">
              <label>Max uses (空=不限)</label>
              <input type="number" min={1} value={editing.max_uses ?? ""} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="field">
              <label>Expires (空=不过期)</label>
              <input type="datetime-local" value={toLocal(editing.expires_at)} onChange={(e) => setEditing({ ...editing, expires_at: fromLocal(e.target.value) })} />
            </div>
            <div className="field">
              <label>Scope</label>
              <select value={editing.scope_event ? "event" : "all"} onChange={(e) => setEditing({ ...editing, scope_event: e.target.value === "event" })}>
                <option value="event">只限本场</option>
                <option value="all">全场通用</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-sm" onClick={() => setEditing(null)}>CANCEL</button>
            <button className="btn-green btn-sm" onClick={save} disabled={pending}>
              {pending ? "SAVING…" : "CREATE CODE"}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => setEditing(EMPTY_CODE)}>
          + ADD CODE
        </button>
      )}
    </div>
  );
}
