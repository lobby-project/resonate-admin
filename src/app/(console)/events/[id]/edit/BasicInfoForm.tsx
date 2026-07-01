"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveEvent, geocodeAddress } from "../../actions";
import { COL_TITLE, COL_VENUE, GENRES } from "@/lib/schemaMap";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ev = Record<string, any>;

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

// 单页基本信息表单(替代旧 7 步向导的步0-4)。票档/促销/设置/发布在运营中心。
// 存草稿 = 方案 C:防抖整表存(~1.2s 空闲)+ 上传成功立即存 + 卸载/完成兜底 flush。
const BASIC_FIELDS = [
  "event_type",
  COL_TITLE,
  "teaser",
  "poster_url",
  "genre",
  "date_tbd",
  "event_date",
  "end_date",
  "timezone",
  "location_type",
  COL_VENUE,
  "address",
  "online_url",
  "details",
];
const pickBasic = (e: Ev): Record<string, unknown> => {
  const p: Record<string, unknown> = {};
  for (const f of BASIC_FIELDS) p[f] = e[f] ?? null;
  return p;
};

export default function BasicInfoForm({ event }: { event: Ev }) {
  const [ev, setEv] = useState<Ev>(event);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const evRef = useRef(ev);
  const firstRef = useRef(true);

  // 保持 evRef 与最新 state 同步(commit 后),供防抖/卸载/override 合并读取
  useEffect(() => {
    evRef.current = ev;
  });

  const set = (k: string, v: unknown) => setEv((p) => ({ ...p, [k]: v }));

  // 立即存(上传成功 / 完成按钮用):override 合并进最新 state 再发,避免 setState 异步滞后丢字段
  function persistNow(override?: Record<string, unknown>, then?: () => void) {
    const src = { ...evRef.current, ...(override ?? {}) };
    start(async () => {
      const r = await saveEvent(src.id, pickBasic(src));
      if (!r.ok) {
        setErr(r.error ?? "Save failed");
        return;
      }
      setErr(null);
      setSavedAt(new Date().toLocaleTimeString());
      then?.();
    });
  }
  const saveNow = (override: Record<string, unknown>) => persistNow(override);

  // 防抖整表自动存:停止输入约 1.2s 后存一次(首渲染不存)
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    const t = setTimeout(() => persistNow(), 1200);
    return () => clearTimeout(t);
  }, [ev]);

  // 卸载兜底:离开页面时把最新内容再存一次(best-effort,不 await)
  useEffect(() => {
    return () => {
      saveEvent(evRef.current.id, pickBasic(evRef.current));
    };
  }, []);

  function finish() {
    start(async () => {
      const r = await saveEvent(ev.id, pickBasic(ev));
      if (!r.ok) {
        setErr(r.error ?? "Save failed");
        return;
      }
      router.push(`/events/${ev.id}`);
    });
  }

  const isNew = ev[COL_TITLE] === "UNTITLED EVENT";

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-h">
        <h1>{isNew ? "CREATE EVENT" : ev[COL_TITLE]}</h1>
        <span className={"badge " + (ev.status === "published" ? "live" : ev.status === "canceled" ? "" : "draft")}>
          {String(ev.status).toUpperCase()}
        </span>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="small muted" style={{ letterSpacing: ".12em", marginBottom: 18 }}>
        {pending ? "SAVING…" : savedAt ? `DRAFT SAVED · ${savedAt}` : "Autosave: saves a draft ~1s after you stop typing"}
      </div>

      <Block title="Type">
        <StepType ev={ev} set={set} />
      </Block>
      <Block title="Basic Info">
        <StepInfo ev={ev} set={set} saveNow={saveNow} />
      </Block>
      <Block title="Details">
        <StepDetails ev={ev} set={set} saveNow={saveNow} />
      </Block>
      <Block title="Date & Time">
        <StepDate ev={ev} set={set} />
      </Block>
      <Block title="Location">
        <StepLocation ev={ev} set={set} />
      </Block>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="hint small muted" style={{ margin: 0 }}>
          Before publishing: Title · Poster · (physical) Address · (ticketed) at least one ticket tier.
          Tickets / discount codes / fees + publishing all live in the<span className="green"> Operations </span>sections.
        </div>
      </div>

      <div className="wiz-foot">
        <button className="btn-green" onClick={finish} disabled={pending}>
          {pending ? "SAVING…" : "Done → Operations"}
        </button>
      </div>
    </div>
  );
}

/* 分区块外壳:统一 panel + 灰标题(替代旧向导的 STEP n/7) */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="small muted" style={{ letterSpacing: ".16em", marginBottom: 18 }}>{title}</div>
      {children}
    </div>
  );
}

/* ---------------- 类型 ---------------- */
function StepType({ ev, set }: { ev: Ev; set: (k: string, v: unknown) => void }) {
  return (
    <div>
      <div className="choice-row">
        <div
          className={"choice " + (ev.event_type === "ticketed" ? "on" : "")}
          onClick={() => set("event_type", "ticketed")}
        >
          <div className="c-t">TICKET EVENT</div>
          <div className="c-d">Sell tickets. Multiple tiers / early bird / discount codes, Stripe payments, QR e-tickets.</div>
        </div>
        <div
          className={"choice " + (ev.event_type === "rsvp" ? "on" : "")}
          onClick={() => set("event_type", "rsvp")}
        >
          <div className="c-t">RSVP EVENT</div>
          <div className="c-d">Free event; registered users RSVP to hold a spot. Low-friction acquisition hook, optional capacity cap.</div>
        </div>
      </div>
      <p className="hint small muted" style={{ marginTop: 14 }}>
        TBD-date events can only open RSVP first; paid tickets unlock once the date is set.
      </p>
    </div>
  );
}

/* ---------------- 基本信息(标题 / teaser / genre / 海报) ---------------- */
function StepInfo({
  ev,
  set,
  saveNow,
}: {
  ev: Ev;
  set: (k: string, v: unknown) => void;
  saveNow: (override: Record<string, unknown>) => void;
}) {
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
    if (!ok1x1 && !ok916) setWarn("Note: poster is not 1:1 or 9:16; the feed thumbnail will center-crop.");

    setUploading(true);
    const supabase = createClient();
    const path = `posters/${ev.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const { error } = await supabase.storage.from("event-assets").upload(path, file);
    setUploading(false);
    if (error) {
      setWarn("Upload failed: " + error.message);
      return;
    }
    const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
    set("poster_url", data.publicUrl);
    saveNow({ poster_url: data.publicUrl }); // 上传成功立即存,不等防抖
  }

  return (
    <div>
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
        <label>Genre (optional · used for product taste matching)</label>
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
        <label>Poster * (1:1 or 9:16 portrait)</label>
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
              Preview = square feed thumbnail crop. Detail page shows full ratio.
            </div>
            {warn && (
              <div className="hint" style={{ color: "var(--warn)" }}>
                {warn}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 时间 ---------------- */
function StepDate({ ev, set }: { ev: Ev; set: (k: string, v: unknown) => void }) {
  return (
    <div>
      <div className="field">
        <label className="toggle" style={{ textTransform: "none" }}>
          <input
            type="checkbox"
            checked={!!ev.date_tbd}
            onChange={(e) => set("date_tbd", e.target.checked)}
          />
          Date TBD — publish to gather RSVPs, open sales once the date is locked
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

/* ---------------- 地点 ---------------- */
function StepLocation({ ev, set }: { ev: Ev; set: (k: string, v: unknown) => void }) {
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function testGeocode() {
    setChecking(true);
    setGeoMsg(null);
    const r = await geocodeAddress(`${ev[COL_VENUE] ?? ""} ${ev.address ?? ""}`.trim());
    setChecking(false);
    setGeoMsg(r.ok ? `✓ Coordinates resolved (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}) — added to the coordinate system on publish` : "✗ " + r.error);
  }

  const lt = ev.location_type ?? "physical";
  return (
    <div>
      <div className="row3" style={{ marginBottom: 18 }}>
        {(["physical", "online", "tbd"] as const).map((t) => (
          <div key={t} className={"choice " + (lt === t ? "on" : "")} onClick={() => set("location_type", t)}>
            <div className="c-t">{t.toUpperCase()}</div>
            <div className="c-d">
              {t === "physical" ? "Physical venue, enters city filtering" : t === "online" ? "Online, lives only on the R◉SELECTED shelf" : "TBD, shelf only"}
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
            <div className="hint">Auto-geocoded on publish into coordinates for city filtering and the swipe pool</div>
          </div>
          <button className="btn btn-sm" onClick={testGeocode} disabled={checking || !ev.address}>
            {checking ? "CHECKING…" : "TEST GEOCODE"}
          </button>
          {geoMsg && (
            <div className="hint" style={{ marginTop: 8, color: geoMsg.startsWith("✓") ? "var(--accent)" : "var(--danger)" }}>
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

/* ---------------- 详情(富文本=文字块+图片块) ---------------- */
type Block2 = { type: "p"; text: string } | { type: "img"; url: string };

function StepDetails({
  ev,
  set,
  saveNow,
}: {
  ev: Ev;
  set: (k: string, v: unknown) => void;
  saveNow: (override: Record<string, unknown>) => void;
}) {
  const blocks: Block2[] = Array.isArray(ev.details) ? ev.details : [];
  const [uploading, setUploading] = useState(false);

  const update = (next: Block2[]) => set("details", next);

  async function addImage(file: File) {
    setUploading(true);
    const supabase = createClient();
    const path = `details/${ev.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const { error } = await supabase.storage.from("event-assets").upload(path, file);
    setUploading(false);
    if (error) return;
    const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
    const next: Block2[] = [...blocks, { type: "img", url: data.publicUrl }];
    update(next);
    saveNow({ details: next }); // 加图立即存,不等防抖
  }

  return (
    <div>
      {blocks.map((b, i) => (
        <div className="blk" key={i}>
          {b.type === "p" ? (
            <textarea
              value={b.text}
              placeholder="Write something…"
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
        Images only, no video (by design).
      </p>
    </div>
  );
}
