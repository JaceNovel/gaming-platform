import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiBase = String(process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  if (!apiBase) {
    return new Response("API base URL not configured", { status: 500 });
  }

  const upstreamUrl = `${apiBase}/gaming-accounts/seller/agreement-pdf`;

  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  headers.set("accept", request.headers.get("accept") ?? "application/pdf,application/json;q=0.9,*/*;q=0.8");

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "";

  // Stream pdf/binary as-is.
  if (upstream.ok && !contentType.includes("application/json")) {
    const body = await upstream.arrayBuffer();

    const respHeaders = new Headers();
    respHeaders.set("Content-Type", contentType || "application/pdf");

    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) respHeaders.set("Content-Disposition", contentDisposition);

    respHeaders.set("Cache-Control", "no-store");

    return new Response(body, { status: upstream.status, headers: respHeaders });
  }

  // Otherwise return text/json error body.
  const text = await upstream.text();
  const respHeaders = new Headers();
  respHeaders.set("Content-Type", contentType || "text/plain; charset=utf-8");
  respHeaders.set("Cache-Control", "no-store");
  return new Response(text, { status: upstream.status, headers: respHeaders });
}
