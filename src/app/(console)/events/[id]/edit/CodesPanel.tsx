"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCode, deactivateCode, type CodeInput } from "../../actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

const $ = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(2)}`);
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

const EMPTY_CODE: CodeInput = { code: "", percent_off: null, amount_off_cents: null, max_uses: null, expires_at: null, scope_event: true };

export default function CodesPanel({ event, codes }: { event: any; codes: any[] }) {
  const [editing, setEditing] = useState<CodeInput | null>(null);
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function save() {
    if (!editing) return;
    if (!editing.code.trim()) return setErr("Code is required");
    if (mode === "percent" && !editing.percent_off) return setErr("Percentage is required");
    if (mode === "amount" && !editing.amount_off_cents) return setErr("Discount amount is required");
    setErr(null);
    start(async () => {
      const payload = { ...editing, percent_off: mode === "percent" ? editing.percent_off : null, amount_off_cents: mode === "amount" ? editing.amount_off_cents : null };
      const r = await upsertCode(event.id, payload);
      if (!r.ok) return setErr(r.error ?? "Save failed");
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
            <span>{c.event_id ? "This event only" : "All events"}</span>
            <span>{c.max_uses ? `${c.used_count}/${c.max_uses} used` : "Unlimited uses"}</span>
            {c.expires_at && <span>Expires {new Date(c.expires_at).toLocaleDateString()}</span>}
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
              <label>Max uses (empty = unlimited)</label>
              <input type="number" min={1} value={editing.max_uses ?? ""} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="field">
              <label>Expires (empty = never)</label>
              <input type="datetime-local" value={toLocal(editing.expires_at)} onChange={(e) => setEditing({ ...editing, expires_at: fromLocal(e.target.value) })} />
            </div>
            <div className="field">
              <label>Scope</label>
              <select value={editing.scope_event ? "event" : "all"} onChange={(e) => setEditing({ ...editing, scope_event: e.target.value === "event" })}>
                <option value="event">This event only</option>
                <option value="all">All events</option>
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
