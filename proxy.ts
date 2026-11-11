import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Routes that require an authenticated session. */
const PROTECTED_ROUTES = ["/dashboard", "/wallet", "/activities", "/bookmarks", "/referrals", "/notifications", "/settings"];
const ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

/**
 * Next.js 16 replaces middleware.ts with proxy.ts.
 * Refreshes the Supabase session cookie and enforces route guards on the
 * server — hiding links in the UI is never sufficient authorization.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Without Supabase credentials there is no session to manage; let the app
  // render its "connect Supabase" states instead of crashing.
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between client creation and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const needsAuth = PROTECTED_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const needsAdmin = ADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const onAuthRoute = AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (needsAdmin) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Role check happens again inside every admin page/server action.
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin", "moderator"])
      .maybeSingle();

    if (!roleRow) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (user && onAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico)$).*)",
  ],
};
