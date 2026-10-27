import { NextResponse } from "next/server";

// Reject before rendering: a streamed notFound() can otherwise carry HTTP 200.
export function proxy() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.EVENTOPS_INTERNAL_UI !== "1"
  ) {
    return new NextResponse("Page not found.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.next();
}

export const config = { matcher: "/internal/:path*" };
