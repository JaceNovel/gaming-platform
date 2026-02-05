import type { NextConfig } from "next";

const safeUrl = (value: string | undefined) => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const apiUrl = safeUrl(process.env.NEXT_PUBLIC_API_URL);
const apiPattern = apiUrl
  ? {
      protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
      hostname: apiUrl.hostname,
      port: apiUrl.port || undefined,
    }
  : null;

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "img.freepik.com" },
      ...(apiPattern ? [apiPattern] : []),
      // Local dev defaults / fallback
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "http", hostname: "localhost", port: "8000" },
    ],
  },
};

export default nextConfig;
