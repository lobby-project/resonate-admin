// 管理台侧 Resend 发信(fetch API,无 SDK)。
// 环境变量:RESEND_API_KEY 必须;RESEND_FROM 建议填已验证域名的发件人。

async function send(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY 未配置,跳过:", subject, "→", to);
    return false;
  }
  const from = process.env.RESEND_FROM || "Resonate <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      console.error("[email] Resend 返回", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] 发送失败:", e);
    return false;
  }
}

function shell(inner: string) {
  return `<div style="background:#000;color:#ddd;font-family:monospace;padding:32px 24px;max-width:520px;margin:0 auto;">
    <div style="font-size:20px;color:#fff;margin-bottom:4px;">res<span style="color:#39FF14;">&#9673;</span>nate</div>
    ${inner}
  </div>`;
}

const dateLine = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Date TBD";

export function sendCancelEmail(to: string, eventTitle: string, eventDate: string | null) {
  return send(
    to,
    `Canceled — ${eventTitle}`,
    shell(`
    <div style="font-size:10px;color:#e07070;letter-spacing:3px;margin-bottom:28px;">EVENT CANCELED</div>
    <div style="font-size:17px;color:#fff;margin-bottom:6px;">${eventTitle}</div>
    <div style="font-size:12px;color:#888;margin-bottom:20px;">${dateLine(eventDate)}</div>
    <div style="font-size:12px;color:#bbb;line-height:1.9;">
      This event has been canceled. If you purchased tickets, your refund will be processed back
      to your original payment method. Reply to this email with any questions.
    </div>`)
  );
}

export function sendReminderEmail(to: string, eventTitle: string, eventDate: string | null, venue: string | null) {
  return send(
    to,
    `Tomorrow — ${eventTitle}`,
    shell(`
    <div style="font-size:10px;color:#39FF14;letter-spacing:3px;margin-bottom:28px;">SEE YOU THERE</div>
    <div style="font-size:17px;color:#fff;margin-bottom:6px;">${eventTitle}</div>
    <div style="font-size:12px;color:#888;margin-bottom:20px;">${dateLine(eventDate)}${venue ? " · " + venue : ""}</div>
    <div style="font-size:12px;color:#bbb;line-height:1.9;">
      Your event is coming up. Your QR ticket is in the app — open MY TICKETS and show it at the door.
    </div>`)
  );
}

export function sendRefundEmail(to: string, eventTitle: string, amountCents: number) {
  return send(
    to,
    `Refunded — ${eventTitle}`,
    shell(`
    <div style="font-size:10px;color:#888;letter-spacing:3px;margin-bottom:28px;">REFUND PROCESSED</div>
    <div style="font-size:17px;color:#fff;margin-bottom:6px;">${eventTitle}</div>
    <div style="font-size:14px;color:#39FF14;margin-bottom:20px;">$${(amountCents / 100).toFixed(2)}</div>
    <div style="font-size:12px;color:#bbb;line-height:1.9;">
      Your order has been refunded to your original payment method. Banks typically take 5–10
      business days to post it. The tickets on this order are no longer valid.
    </div>`)
  );
}
