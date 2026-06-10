"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveEvent, geocodeAddress } from "../../actions";
import { COL_TITLE, COL_VENUE, GENRES } from "@/lib/schemaMap";
import StepTickets from "./StepTickets";
import StepSettings from "./StepSettings";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ev = Record<string, any>;

const STEPS = ["TYPE", "INFO", "DATE & TIME", "LOCATION", "DETAILS", "TICKETS / RSVP", "SETTINGS"];

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocal(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

export default function Wizard({
  event,
  tiers,
  codes,
}: {
  event: Ev;
  tiers: any[];
  codes: any[];
}) {
  const [step, setStep] = useState(0);
  const [ev, setEv] = useState<Ev>(event);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (k: string, v: unknown) => setEv((p) => ({ ...p, [k]: v }));

  // 每步离开时持久化该步字段(自动草稿)
  const STEP_FIELDS: string[][] = useMemo(
    () => [
      ["event_type"],
      [COL_TITLE, "teaser", "poster_url", "genre"],
      ["date_tbd", "event_date", "end_date", "timezone"],
      ["location_type", COL_VENUE, "address", "online_url"],
      ["details"],
      [], // tickets 自己管自己
      [], // settings 自己管自己
    ],
    []
  );

  function persist(stepIdx: number, then?: () => void) {
    const patch: Record<string, unknown> = {};
    for (const f of STEP_FIELDS[stepIdx]) patch[f] = ev[f] ?? null;
    if (Object.keys(patch).length === 0) {
      then?.();
      return;
    }
    startTransition(async () => {
      const r = await saveEvent(ev.id, patch);
      if (!r.ok) {
        setErr(r.error ?? "保存失败");
        return;
      }
      setErr(null);
      setSavedAt(new Date().toLocaleTimeString());
      then?.();
    });
  }

  const goto = (i: number) => persist(step, () => setStep(i));
  const next = () => goto(Math.min(step + 1, 6));
  const back = () => goto(Math.max(step - 1, 0));

  return (
    <div>
      <div className="page-h">
        <h1>{ev[COL_TITLE] === "UNTITLED EVENT" ? "CREATE EVENT" : ev[COL_TITLE]}</h1>
        <span className={"badge " + (ev.status === "published" ? "live" : "draft")}>
          {String(ev.status).toUpperCase()}
        </span>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="wiz">
        <div className="rail">
          {STEPS.map((s, i) => (
            <button
              key={s}
              className={"rail-i " + (i === step ? "cur" : i < step ? "done" : "")}
              onClick={() => goto(i)}
            >
              <span className="dot">{i < step ? "✓" : i + 1}</span> {s}
            </button>
          ))}
          <div className="rail-save">
            {pending ? "SAVING…" : savedAt ? `DRAFT SAVED · ${savedAt}` : "AUTOSAVE ON STEP CHANGE"}
          </div>
        </div>

        <div className="panel">
          {step === 0 && <StepType ev={ev} set={set} />}
          {step === 1 && <StepInfo ev={ev} set={set} />}
          {step === 2 && <StepDate ev={ev} set={set} />}
          {step === 3 && <StepLocation ev={ev} set={set} />}
          {step === 4 && <StepDetails ev={ev} set={set} />}
          {step === 5 && <StepTickets event={ev} tiers={tiers} codes={codes} />}
          {step === 6 && <StepSettings event={ev} />}

          {step < 5 && (
            <div className="wiz-foot">
              <button className="btn" onClick={back} disabled={step === 0}>
                ← BACK
              </button>
              <button className="btn-green" onClick={next} disabled={pending}>
                {pending ? "SAVING…" : "SAVE & NEXT →"}
              </button>
            </div>
          )}
          {step === 5 && (
            <div className="wiz-foot">
              <button className="btn" onClick={() => setStep(4)}>
                ← BACK
              </button>
              <button className="btn-green" onClick={() => setStep(6)}>
                NEXT →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- STEP 1: TYPE ---------------- */
function StepType({ ev, set }: { ev: Ev; set: (k: string, v: unknown) => void }) {
  return (
    <div>
      <h2 className="small muted" style={{ letterSpacing: ".16em", marginBottom: 18 }}>
        STEP 1 / 7 — EVENT TYPE
      </h2>
      <div className="choice-row">
        <div
          className={"choice " + (ev.event_type === "ticketed" ? "on" : "")}
          onClick={() => set("event_type", "ticketed")}
        >
          <div className="c-t">TICKET EVENT</div>
          <div className="c-d">卖票收钱。多票档 / 早鸟 / 折扣码,Stripe 收款,出二维码电子票。</div>
        </div>
        <div
          className={"choice " + (ev.event_type === "rsvp" ? "on" : "")}
          onClick={() => set("event_type", "rsvp")}
        >
          <div className="c-t">RSVP EVENT</div>
          <div className="c-d">免费活动,注册用户报名占位。低门槛获客钩子,可设容量上限。</div>
        </div>
      </div>
      <p className="hint small muted" style={{ marginTop: 14 }}>
        日期 TBD 的活动只能先开 RSVP 攒人,锁定日期后才能开售付费票。
      </p>
    </div>
  );
}

/* ---------------- STEP 2: INFO ---------------- */
function StepInfo({ ev, set }: { ev: Ev; set: (k: string, v: unknown) => void }) {
  const [uploading, setUploading] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  async function onPoster(file: File) {
    setWarn(null);
    // 校验比例:1:1 或 9:16(±8% 容差),不合规警告但不拦
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((res) => {
      img.onload = res;
      img.src = url;
    });
    const ratio = img.width / img.height;
    const ok1x1 = Math.abs(ratio - 1) < 0.08;
    const ok916 = Math.abs(ratio - 9 / 16) < 0.06;
    if (!ok1x1 && !ok916) setWarn("提示:海报不是 1:1 也不是 9:16,feed 缩略图会从中心裁切");

    setUploading(true);
    const supabase = createClient();
    const path = `posters/${ev.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const { error } = await supabase.storage.from("event-assets").upload(path, file);
    setUploading(false);
    if (error) {
      setWarn("上传失败:" + error.message);
      return;
    }
    const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
    set("poster_url", data.publicUrl);
  }

  return (
    <div>
      <h2 className="small muted" style={{ letterSpacing: ".16em", marginBottom: 18 }}>
        STEP 2 / 7 — EVENT INFO
      </h2>
      <div className="field">
        <label>Title *</label>
        <input
          type="text"
          value={ev[COL_TITLE] === "UNTITLED EVENT" ? "" : (ev[COL_TITLE] ?? "")}
          placeholder="RESONATE 001 — warehouse opening night"
          onChange={(e) => set(COL_TITLE, e.target.value)}
        />
      </div>
      <div className="field">
        <label>Short teaser (optional)</label>
        <input
          type="text"
          value={ev.teaser ?? ""}
          placeholder="one line that sells the night…"
          onChange={(e) => set("teaser", e.target.value || null)}
        />
      </div>
      <div className="field">
        <label>Genre (optional · 用于产品端口味匹配)</label>
        <select value={ev.genre ?? ""} onChange={(e) => set("genre", e.target.value || null)}>
          <option value="">— none —</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Poster * (1:1 或 9:16 竖版)</label>
        <div className="poster-box">
          <div className="poster-prev">
            {ev.poster_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ev.poster_url} alt="poster" />
            ) : uploading ? (
              "UPLOADING…"
            ) : (
              "+ UPLOAD"
            )}
          </div>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onPoster(e.target.files[0])}
            />
            <div className="hint">
              预览框 = feed 方形缩略图的裁切效果。详情页按原比例展示。
            </div>
            {warn && (
              <div className="hint" style={{ color: "#e0a060" }}>
                {warn}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- STEP 3: DATE & TIME ---------------- */
function StepDate({ ev, set }: { ev: Ev; set: (k: string, v: unknown) => void }) {
  return (
    <div>
      <h2 className="small muted" style={{ letterSpacing: ".16em", marginBottom: 18 }}>
        STEP 3 / 7 — DATE & TIME
      </h2>
      <div className="field">
        <label className="toggle" style={{ textTransform: "none" }}>
          <input
            type="checkbox"
            checked={!!ev.date_tbd}
            onChange={(e) => set("date_tbd", e.target.checked)}
          />
          日期待定(TBD)——先发布攒 RSVP,日期锁定后再开售
        </label>
      </div>
      {!ev.date_tbd && (
        <>
          <div className="row2">
            <div className="field">
              <label>Starts *</label>
              <input
                type="datetime-local"
                value={toLocal(ev.event_date)}
                onChange={(e) => set("event_date", fromLocal(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Ends (optional)</label>
              <input
                type="datetime-local"
                value={toLocal(ev.end_date)}
                onChange={(e) => set("end_date", fromLocal(e.target.value))}
              />
            </div>
          </div>
          <div className="field">
            <label>Timezone</label>
            <select value={ev.timezone ?? "America/Los_Angeles"} onChange={(e) => set("timezone", e.target.value)}>
              <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
              <option value="America/Denver">America/Denver (MT)</option>
              <option value="America/Chicago">America/Chicago (CT)</option>
              <option value="America/New_York">America/New_York (ET)</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- STEP 4: LOCATION ---------------- */
function StepLocation({ ev, set }: { ev: Ev; set: (k: string, v: unknown) => void }) {
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function testGeocode() {
    setChecking(true);
    setGeoMsg(null);
    const r = await geocodeAddress(`${ev[COL_VENUE] ?? ""} ${ev.address ?? ""}`.trim());
    setChecking(false);
    setGeoMsg(r.ok ? `✓ 坐标解析成功 (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})——发布时自动入坐标体系` : "✗ " + r.error);
  }

  const lt = ev.location_type ?? "physical";
  return (
    <div>
      <h2 className="small muted" style={{ letterSpacing: ".16em", marginBottom: 18 }}>
        STEP 4 / 7 — LOCATION
      </h2>
      <div className="row3" style={{ marginBottom: 18 }}>
        {(["physical", "online", "tbd"] as const).map((t) => (
          <div key={t} className={"choice " + (lt === t ? "on" : "")} onClick={() => set("location_type", t)}>
            <div className="c-t">{t.toUpperCase()}</div>
            <div className="c-d">
              {t === "physical" ? "实体场地,进城市筛选" : t === "online" ? "线上,只住 R◉SELECTED 货架" : "待定,只住货架"}
            </div>
          </div>
        ))}
      </div>
      {lt === "physical" && (
        <>
          <div className="field">
            <label>Venue name *</label>
            <input
              type="text"
              value={ev[COL_VENUE] ?? ""}
              placeholder="The Warehouse DTLA"
              onChange={(e) => set(COL_VENUE, e.target.value || null)}
            />
          </div>
          <div className="field">
            <label>Address *</label>
            <input
              type="text"
              value={ev.address ?? ""}
              placeholder="4061 W Pico Blvd, Los Angeles, CA 90019"
              onChange={(e) => set("address", e.target.value || null)}
            />
            <div className="hint">发布时自动 geocode 成坐标,进产品端的城市筛选和 swipe 池</div>
          </div>
          <button className="btn btn-sm" onClick={testGeocode} disabled={checking || !ev.address}>
            {checking ? "CHECKING…" : "TEST GEOCODE"}
          </button>
          {geoMsg && (
            <div className="hint" style={{ marginTop: 8, color: geoMsg.startsWith("✓") ? "#39FF14" : "#e07070" }}>
              {geoMsg}
            </div>
          )}
        </>
      )}
      {lt === "online" && (
        <div className="field">
          <label>Stream / meeting link *</label>
          <input
            type="text"
            value={ev.online_url ?? ""}
            placeholder="https://…"
            onChange={(e) => set("online_url", e.target.value || null)}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- STEP 5: DETAILS(富文本=文字块+图片块) ---------------- */
type Block = { type: "p"; text: string } | { type: "img"; url: string };

function StepDetails({ ev, set }: { ev: Ev; set: (k: string, v: unknown) => void }) {
  const blocks: Block[] = Array.isArray(ev.details) ? ev.details : [];
  const [uploading, setUploading] = useState(false);

  const update = (next: Block[]) => set("details", next);

  async function addImage(file: File) {
    setUploading(true);
    const supabase = createClient();
    const path = `details/${ev.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const { error } = await supabase.storage.from("event-assets").upload(path, file);
    setUploading(false);
    if (error) return;
    const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
    update([...blocks, { type: "img", url: data.publicUrl }]);
  }

  return (
    <div>
      <h2 className="small muted" style={{ letterSpacing: ".16em", marginBottom: 18 }}>
        STEP 5 / 7 — EVENT DETAILS
      </h2>
      {blocks.map((b, i) => (
        <div className="blk" key={i}>
          {b.type === "p" ? (
            <textarea
              value={b.text}
              placeholder="写点什么…"
              onChange={(e) => {
                const next = [...blocks];
                next[i] = { type: "p", text: e.target.value };
                update(next);
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.url} alt="" />
          )}
          <div className="blk-bar">
            <button className="btn-danger btn-sm" onClick={() => update(blocks.filter((_, j) => j !== i))}>
              REMOVE
            </button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-sm" onClick={() => update([...blocks, { type: "p", text: "" }])}>
          + TEXT
        </button>
        <label className="btn btn-sm" style={{ display: "inline-block" }}>
          {uploading ? "UPLOADING…" : "+ IMAGE"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])}
          />
        </label>
      </div>
      <p className="hint small muted" style={{ marginTop: 12 }}>
        只支持图片,不支持视频(已定)。
      </p>
    </div>
  );
}
