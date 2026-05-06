import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/.*|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request: { headers: request.headers } });
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const path = request.nextUrl.pathname;
  const isAdminPath = path.startsWith("/admin");
  const needsUser = isAdminPath || path.startsWith("/watchlist") || path.startsWith("/settings");
  if (!needsUser) return response;

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminPath) {
    // Admin gating reads `public.admin_users` via the user's RLS context
    // (policy `admin_users_select_self`). Final enforcement also happens
    // server-side in `requireAdmin()` for every admin API call.
    const { data: row } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
