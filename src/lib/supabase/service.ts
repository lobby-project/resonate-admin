import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service role 客户端:绕过 RLS,只在服务端用,
// 且每个使用点必须先用 requireAdmin() 验明身份。
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
