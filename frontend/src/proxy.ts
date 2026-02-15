import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = url.hostname;

  // Force a single canonical host to avoid split caches/service-workers between www and apex.
  if (hostname === "www.primegaming.space") {
    const target = new URL(request.url);
    target.hostname = "primegaming.space";
    return NextResponse.redirect(target, 308);
  }

  // Mitigation for noisy production logs after deploys:
  // old clients (or scanners) can send Server Action requests from a different deployment.
  // If we don't use Server Actions, stripping this header avoids Next throwing
  // "Failed to find Server Action".
  if (request.method !== "GET" && request.headers.has("next-action")) {
    const headers = new Headers(request.headers);
    headers.delete("next-action");
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|sitemap.xml).*)",
  ],
};
