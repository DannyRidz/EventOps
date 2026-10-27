import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/internal")) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.EVENTOPS_INTERNAL_UI !== "1"
    )
      return new NextResponse("Page not found.", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_URL?.startsWith("https://") ?? false,
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  try {
    const { data } = await client.auth.getClaims();
    if (request.nextUrl.pathname.startsWith("/events") && !data?.claims) {
      const destination = NextResponse.redirect(
        new URL("/sign-in", request.url),
      );
      response.cookies
        .getAll()
        .forEach((cookie) => destination.cookies.set(cookie));
      destination.headers.set("Cache-Control", "private, no-store");
      return destination;
    }
  } catch {
    /* Server routes verify identity and report service failure. */
  }
  return response;
}
export const config = {
  matcher: [
    "/internal/:path*",
    "/events/:path*",
    "/sign-in",
    "/api/auth/:path*",
    "/api/events/:path*",
    "/api/workspace/:path*",
  ],
};
