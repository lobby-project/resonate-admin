import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Google OAuth 回调:用 code 换会话 → 回控制台首页 /。
// is_admin 门禁在 (console)/layout.tsx,所以非管理员落到 / 会看到"无权限"卡片。
//
// cookie 持久化:Route Handler 里 next/headers 写的 cookie 不一定能挂到
// NextResponse.redirect 上,所以收集 supabase 要写的 cookie,再显式设到 redirect 响应。
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=no_code`);

  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pending.push(c));
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[admin CB] exchange error:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const res = NextResponse.redirect(`${origin}/`);
  pending.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
  return res;
}
