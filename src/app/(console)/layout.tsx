import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import ConsoleNav from "./ConsoleNav";

// 控制台外壳 + is_admin 硬门禁(服务端校验,不靠前端隐藏)
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: row } = await svc
    .from("users")
    .select("is_admin, display_name")
    .eq("id", user.id)
    .single();

  if (!row?.is_admin) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="side-logo">res<span className="o">◉</span>nate</div>
          <div className="side-sub">TICKETING CONSOLE</div>
          <div className="err">
            This account ({user.email}) does not have console access.
            <br />
            If you are a team member, ask an admin to enable is_admin for you in the database.
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn" style={{ width: "100%" }}>
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-logo">
          res<span className="o">◉</span>nate
        </div>
        <div className="side-sub">TICKETING CONSOLE</div>
        <ConsoleNav />
        <div className="side-foot">
          <div style={{ marginBottom: 8 }}>{row.display_name || user.email}</div>
          <form action="/auth/signout" method="post">
            <button>Sign Out →</button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
