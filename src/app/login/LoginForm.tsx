"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Google 登录(内部后台)。is_admin 门禁在 (console)/layout.tsx:
// 非管理员用 Google 登录后落到 / 会看到"无权限"卡片。无注册入口。
export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const supabase = createClient();

  async function signInWithGoogle() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // 成功时浏览器已被重定向去 Google;这里不会再往下走
    if (error) {
      setBusy(false);
      setErr(error.message);
    }
  }

  return (
    <div>
      {err && <div className="err">{err}</div>}
      <button
        className="btn-green"
        style={{ width: "100%" }}
        disabled={busy}
        onClick={signInWithGoogle}
      >
        {busy ? "REDIRECTING…" : "SIGN IN WITH GOOGLE"}
      </button>
      <p className="small muted" style={{ marginTop: 14, textAlign: "center", lineHeight: 1.6 }}>
        Only is_admin accounts can access the console.
      </p>
    </div>
  );
}
