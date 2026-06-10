import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 普通服务端客户端:带用户会话(读身份用)
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 里调用时忽略(由 proxy 刷新)
          }
        },
      },
    }
  );
}
