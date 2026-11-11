import type { MetadataRoute } from "next";
import { fetchFeed } from "@/lib/feed";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];

  // Include published content discovered by the feed.
  const contentRoutes: MetadataRoute.Sitemap = [];
  const page = await fetchFeed({ limit: 20 }).catch(() => null);

  for (const item of page?.items ?? []) {
    contentRoutes.push({
      url: `${base}/content/${item.slug}`,
      lastModified: item.published_at ? new Date(item.published_at) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return [...staticRoutes, ...contentRoutes];
}
