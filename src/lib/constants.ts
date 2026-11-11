export const SITE_NAME = "ARKSOME";
export const TAGLINE = "Discover. Scroll. Explore. Get Rewarded.";
export const COIN_NAME = "ARKSOME Coins";
export const COIN_ABBREV = "AC";

/**
 * Coins are internal, non-cash platform points. Every UI string that mentions
 * coins should stay consistent with this disclaimer.
 */
export const COIN_DISCLAIMER =
  "ARKSOME Coins (AC) are internal platform points only. They have no cash value, cannot be withdrawn or sold, and cannot be transferred between users.";

export const publicNav = [
  { href: "/", label: "Feed" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const authedNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/activities", label: "Activities" },
  { href: "/wallet", label: "Wallet" },
  { href: "/bookmarks", label: "Saved" },
  { href: "/referrals", label: "Referrals" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
];

export const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/ads", label: "Ads & campaigns" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/activities", label: "Activities" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit-logs", label: "Audit logs" },
  { href: "/admin/settings", label: "Settings" },
];

/** Server-side rate limits (requests per window) for sensitive actions. */
export const RATE_LIMITS = {
  rewardClaim: { limit: 10, windowMs: 60_000 },
  authAction: { limit: 5, windowMs: 60_000 },
  report: { limit: 5, windowMs: 60_000 },
} as const;
