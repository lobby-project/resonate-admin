import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// 所有 server action / 管理页的统一门禁:
// 返回 { user, svc } 或抛错。svc = service role 客户端。
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const svc = createServiceClient();
  const { data: row } = await svc
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!row?.is_admin) throw new Error("FORBIDDEN");
  return { user, svc };
}
