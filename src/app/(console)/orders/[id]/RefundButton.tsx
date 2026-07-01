"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refundOrder } from "../actions";

export default function RefundButton({ orderId, total }: { orderId: string; total: string }) {
  const [arm, setArm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div>
      {err && <div className="err">{err}</div>}
      {!arm ? (
        <button className="btn-danger" onClick={() => setArm(true)}>REFUND {total}…</button>
      ) : (
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <span className="small muted">Refund the full {total} to the original card. Tickets will be voided and inventory restored. Confirm?</span>
          <button
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await refundOrder(orderId);
                if (!r.ok) return setErr(r.error ?? "Refund failed");
                router.refresh();
              })
            }
          >
            {pending ? "REFUNDING…" : "CONFIRM REFUND"}
          </button>
          <button className="btn btn-sm" onClick={() => setArm(false)}>BACK</button>
        </span>
      )}
    </div>
  );
}
