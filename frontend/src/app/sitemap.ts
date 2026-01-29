import type { MetadataRoute } from "next";

const getSiteUrl = () => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return raw !== "" ? raw.replace(/\/$/, "") : "https://badboyshop.online";
};

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  // Keep this list stable and public-only.
  const routes = ["/", "/shop", "/premium", "/account"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: path === "/" ? 1 : 0.8,
  }));

  return routes;
}
