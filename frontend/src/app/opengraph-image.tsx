import { ImageResponse } from "next/og";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getBaseUrl() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";

  if (host) return `${proto}://${host}`;
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://primegaming.space").replace(/\/$/, "");
}

export default async function OpenGraphImage() {
  const baseUrl = await getBaseUrl();
  const logoUrl = new URL(
    "/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png",
    baseUrl,
  );

  let logoBytes: ArrayBuffer;
  try {
    logoBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
  } catch {
    const fallbackUrl = new URL(
      "/images/Capture_d_écran_2026-02-10_115245-removebg-preview.png",
      "https://primegaming.space",
    );
    logoBytes = await fetch(fallbackUrl).then((res) => res.arrayBuffer());
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 72,
          background: "#0B0F19",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>PRIME Gaming</div>
          <div style={{ fontSize: 28, opacity: 0.85, lineHeight: 1.3 }}>
            Plateforme gaming panafricaine – Comptes, recharges et services premium.
          </div>
          <div style={{ marginTop: 10, fontSize: 22, opacity: 0.75 }}>primegaming.space</div>
        </div>

        <div
          style={{
            width: 340,
            height: 340,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 48,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoBytes as any}
            width={260}
            height={260}
            alt="PRIME Gaming"
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
    },
  );
}
