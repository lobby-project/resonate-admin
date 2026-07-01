"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEvent, upsertTier, deleteTier, type TierInput } from "../../actions";
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

// 门票管理:RSVP 容量 或 票档列表(按 event_type 分流)。
// 创建向导(Wizard 步5)和单场「门票」分区共用同一份逻辑。
export default function TicketManager({ event, tiers }: { event: any; tiers: any[] }) {
  const isRsvp = event.event_type === "rsvp";
  return isRsvp ? <RsvpPanel event={event} /> : <TiersPanel event={event} tiers={tiers} />;
}

/* ---------------- RSVP 容量 ---------------- */
function RsvpPanel({ event }: { event: any }) {
  const [cap, setCap] = useState<string>(event.rsvp_capacity ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label>RSVP capacity (empty = unlimited)</label>
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
    if (!editing.name.trim()) return setErr("Ticket name is required");
    if (editing.pricing_method === "fixed" && (editing.price_cents == null || editing.price_cents <= 0))
      return setErr("Fixed-price tickets need a price");
    setErr(null);
    start(async () => {
      const r = await upsertTier(event.id, { ...editing, sort_order: editing.sort_order ?? tiers.length });
      if (!r.ok) return setErr(r.error ?? "Save failed");
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
              <span>{t.quantity_total == null ? "Unlimited" : `${t.quantity_sold}/${t.quantity_total} sold`}</span>
              {t.sale_ends_at && <span>Ends {new Date(t.sale_ends_at).toLocaleString()}</span>}
            </div>
          </div>
        )
      )}
      {editing && !editing.id && (
        <TierForm tier={editing} setTier={setEditing as any} onSave={save} onCancel={() => setEditing(null)} pending={pending} err={err} />
      )}
      {!editing && (
        <button className="btn" onClick={() => setEditing({ ...EMPTY_TIER, sort_order: tiers.length })}>
          + Add Tier
        </button>
      )}
      <p className="hint small muted" style={{ marginTop: 12 }}>
        Early bird = a tier with a sale end time. Guest/comp = a HIDDEN tier + a dedicated discount code.
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
        <label>Description (optional · shown on checkout)</label>
        <input type="text" value={tier.description ?? ""} placeholder="Includes backstage access + free drink" onChange={(e) => s("description", e.target.value || null)} />
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
            <label>Min price (USD · can be 0)</label>
            <input
              type="number" min={0} step={0.01}
              value={tier.min_price_cents == null ? "" : tier.min_price_cents / 100}
              onChange={(e) => s("min_price_cents", e.target.value ? Math.round(Number(e.target.value) * 100) : 0)}
            />
          </div>
        )}
        <div className="field">
          <label>Quantity (empty = unlimited)</label>
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
          <label>Sale starts (empty = immediately)</label>
          <input type="datetime-local" value={toLocal(tier.sale_starts_at)} onChange={(e) => s("sale_starts_at", fromLocal(e.target.value))} />
        </div>
        <div className="field">
          <label>Sale ends (empty = with event · set early-bird cutoff here)</label>
          <input type="datetime-local" value={toLocal(tier.sale_ends_at)} onChange={(e) => s("sale_ends_at", fromLocal(e.target.value))} />
        </div>
      </div>
      <div className="field">
        <label>Ticket note (printed on the ticket)</label>
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
