import { ImageResponse } from "next/og";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

async function getBaseUrl() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";

  if (host) return `${proto}://${host}`;
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://primegaming.space").replace(/\/$/, "");
}

export default async function Icon() {
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
          justifyContent: "center",
          background: "#0B0F19",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoBytes as any}
          width={28}
          height={28}
          alt="PRIME"
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    {
      width: size.width,
      height: size.height,
    },
  );
}
