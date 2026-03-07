import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/invite/accept"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiPath = pathname.startsWith("/api/");
  const isPublicPath = PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`)
  );

  let response = NextResponse.next({
    request
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    const message =
      "Server misconfiguration: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY";
    console.error(message);
    if (isApiPath) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return new NextResponse(message, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  type CookieOptions = Parameters<typeof response.cookies.set>[2];
  type CookieToSet = {
    name: string;
    value: string;
    options?: CookieOptions;
  };

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    });

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user && !isPublicPath && !isApiPath && pathname !== "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  } catch (error) {
    console.error("Middleware auth check failed", error);
    if (!isPublicPath && !isApiPath && pathname !== "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    if (isApiPath) {
      return NextResponse.json({ error: "Middleware auth check failed" }, { status: 500 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
