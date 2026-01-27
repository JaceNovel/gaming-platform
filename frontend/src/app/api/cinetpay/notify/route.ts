import { API_BASE } from "@/lib/config";

function parseBodyFromText(bodyText: string): Record<string, any> {
  const trimmed = bodyText.trim();
  if (!trimmed) return {};

  // Try JSON first
  try {
    const json = JSON.parse(trimmed);
    if (json && typeof json === "object") return json;
  } catch {
    // ignore
  }

  // Fallback to x-www-form-urlencoded
  const params = new URLSearchParams(trimmed);
  const out: Record<string, any> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  let payload: any = {};
  try {
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const text = await req.text();
      payload = parseBodyFromText(text);
    }
  } catch {
    payload = {};
  }

  // Forward webhook to Laravel API (does signature verification + updates order/payment).
  const target = `${API_BASE}/payments/cinetpay/webhook`;

  const upstream = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "bbshop-frontend-webhook-proxy",
    },
    body: JSON.stringify(payload ?? {}),
    // CinetPay expects fast response; do not cache.
    cache: "no-store",
  });

  const text = await upstream.text().catch(() => "");

  return new Response(text || "ok", {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/plain",
    },
  });
}
