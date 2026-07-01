"use client";

import { useState } from "react";

const PRODUCT_URL = process.env.NEXT_PUBLIC_PRODUCT_URL || "http://localhost:3000";

// ⚠️ 必须和产品端 src/lib/channel.ts 的 cleanRef 规则保持一致(两个 repo,手动同步)。
const cleanRef = (raw: string) => raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);

// 纯前端:输渠道名 → 拼指向产品的归因链接 → 复制。无 DB。
export default function ChannelLinkBuilder({ eventId }: { eventId: string }) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const ref = cleanRef(name);
  const url = ref ? `${PRODUCT_URL}/events/${eventId}?ref=${ref}` : "";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 12 }}>CHANNEL LINKS</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name e.g. instagram"
          style={{ flex: 1, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontFamily: "inherit", fontSize: 13, padding: "9px 12px", outline: "none" }}
        />
        <button className="btn btn-sm" disabled={!url} onClick={copy}>
          {copied ? "COPIED ✓" : "COPY LINK"}
        </button>
      </div>
      {url && (
        <div className="small muted" style={{ marginTop: 10, wordBreak: "break-all" }}>{url}</div>
      )}
      <div className="small" style={{ marginTop: 8, color: "var(--text-4)" }}>
        Share this link on that channel; purchases coming through it are attributed to it.
      </div>
    </div>
  );
}
