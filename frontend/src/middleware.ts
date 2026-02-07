import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = url.hostname;

  // Force a single canonical host to avoid split caches/service-workers between www and apex.
  if (hostname === "www.badboyshop.online") {
    const target = new URL(request.url);
    target.hostname = "badboyshop.online";
    return NextResponse.redirect(target, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|sitemap.xml).*)",
  ],
};
