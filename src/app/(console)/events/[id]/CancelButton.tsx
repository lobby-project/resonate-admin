"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelEvent } from "../../orders/actions";

export default function CancelButton({ eventId }: { eventId: string }) {
  const [arm, setArm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (msg) return <span className="small green">{msg}</span>;
  if (!arm)
    return (
      <button className="btn-danger" onClick={() => setArm(true)}>
        CANCEL EVENT…
      </button>
    );
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <span className="small muted">确认取消?将停售并邮件通知所有持票人</span>
      <button
        className="btn-danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelEvent(eventId);
            if (!r.ok) return setMsg("✗ " + r.error);
            setMsg(`✓ 已取消,通知了 ${r.notified}/${r.holders} 位持票人`);
            router.refresh();
          })
        }
      >
        {pending ? "…" : "CONFIRM"}
      </button>
      <button className="btn btn-sm" onClick={() => setArm(false)}>
        BACK
      </button>
    </span>
  );
}
