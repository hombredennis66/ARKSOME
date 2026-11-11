import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Coins are internal platform points, never cash. Always format as AC. */
export function formatCoins(amount: number) {
  return `${new Intl.NumberFormat("en-US").format(amount)} AC`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

/** Simple slug helper used by admin content forms. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Human label for an idempotent reward event type. */
export function rewardLabel(eventType: string) {
  const labels: Record<string, string> = {
    daily_checkin: "Daily check-in",
    quiz_correct: "Quiz answer",
    quiz_completed: "Quiz completed",
    content_read: "Content discovery",
    referral_signup: "Referral signup",
    streak_bonus: "Streak bonus",
    rewarded_ad: "Rewarded ad",
    admin_adjustment: "Admin adjustment",
    manual_adjustment: "Manual adjustment",
  };
  return labels[eventType] ?? eventType.replace(/_/g, " ");
}
