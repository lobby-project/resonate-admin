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
        setErr(r.error ?? "保存失败");
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
        setErr(r.error ?? "保存失败");
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
        {pending ? "SAVING…" : savedAt ? `DRAFT SAVED · ${savedAt}` : "自动保存:停笔约 1 秒存草稿"}
      </div>

      <Block title="类型">
        <StepType ev={ev} set={set} />
      </Block>
      <Block title="基本信息">
        <StepInfo ev={ev} set={set} saveNow={saveNow} />
      </Block>
      <Block title="详情">
        <StepDetails ev={ev} set={set} saveNow={saveNow} />
      </Block>
      <Block title="时间">
        <StepDate ev={ev} set={set} />
      </Block>
      <Block title="地点">
        <StepLocation ev={ev} set={set} />
      </Block>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="hint small muted" style={{ margin: 0 }}>
          发布前需:标题 · 海报 · (实体活动)地址 · (售票活动)至少一个票档。
          票档 / 折扣码 / 费用设置 + 正式发布都在<span className="green"> 运营中心 </span>对应分区操作。
        </div>
      </div>

      <div className="wiz-foot">
        <button className="btn-green" onClick={finish} disabled={pending}>
          {pending ? "SAVING…" : "完成 → 进运营中心"}
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

/* ---------------- 地点 ---------------- */
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
