"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 密码登录(内部后台,不依赖邮件)。
// 账号密码用 scripts/set-admin-password.mjs 一次性设置。
// 没有注册入口:管理员只能由数据库 is_admin + 该脚本产生。
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function signIn() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div>
      {err && <div className="err">{err}</div>}
      <div className="field">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </div>
      <div className="field">
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && email && password && signIn()}
        />
      </div>
      <button
        className="btn-green"
        style={{ width: "100%" }}
        disabled={busy || !email || !password}
        onClick={signIn}
      >
        {busy ? "SIGNING IN…" : "ENTER CONSOLE"}
      </button>
    </div>
  );
}
