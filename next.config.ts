import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ARKSOME is an auth-heavy, mostly dynamic app (feeds, wallet, dashboard).
  // Cache Components would force every page behind a Suspense boundary to
  // access cookies(), so we opt out and keep the app explicitly dynamic.
  cacheComponents: false,
  partialPrefetching: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "commondatastorage.googleapis.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
