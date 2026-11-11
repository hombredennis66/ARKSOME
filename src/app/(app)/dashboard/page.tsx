import Link from "next/link";
import { Bell, Bookmark, Check, Flame, Users, Wallet as WalletIcon, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatCoins, formatDate, formatNumber, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import type { Activity, CoinTransaction } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { href: "/activities", label: "Earn", icon: Zap, description: "Check-ins, quizzes & tasks" },
  { href: "/wallet", label: "Wallet", icon: WalletIcon, description: "Transaction history" },
  { href: "/bookmarks", label: "Saved", icon: Bookmark, description: "Content you bookmarked" },
  { href: "/referrals", label: "Referrals", icon: Users, description: "Invite friends to join" },
] as const;

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;

  const user = await requireUser("/dashboard");
  const today = new Date().toISOString().slice(0, 10);

  const [todayRes, latestCheckinRes, txRes, activitiesRes, referralRes, unreadRes] =
    await Promise.all([
      supabase
        .from("daily_checkins")
        .select("checkin_date, streak_count, coins_awarded")
        .eq("user_id", user.id)
        .eq("checkin_date", today)
        .maybeSingle(),
      supabase
        .from("daily_checkins")
        .select("streak_count")
        .eq("user_id", user.id)
        .order("checkin_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("coin_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("activities")
        .select("*")
        .eq("enabled", true)
        .order("position", { ascending: true })
        .limit(5),
      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", user.id),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);

  const checkedInToday = Boolean(todayRes.data);
  const checkinCoins = todayRes.data?.coins_awarded ?? 0;
  const streak = latestCheckinRes.data?.streak_count ?? 0;
  const recent: CoinTransaction[] = txRes.data ?? [];
  const activities: Activity[] = activitiesRes.data ?? [];
  const referralCount = referralRes.count ?? 0;
  const unreadCount = unreadRes.count ?? 0;

  const name = user.displayName ?? user.username ?? "there";
  const greeting = greetingFor(new Date().getHours());

  return (
    <div className="space-y-8">
      {/* Greeting + balance */}
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {formatDate(new Date())}
          </p>
          <h1 className="mt-1 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting}, {name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {checkedInToday ? (
              <Badge variant="success">
                <Check className="size-3" aria-hidden /> Checked in today
                {checkinCoins > 0 && <> · {formatCoins(checkinCoins)}</>}
              </Badge>
            ) : (
              <Badge variant="warning">Not checked in yet</Badge>
            )}
            <Badge variant="coin">
              <Flame className="size-3" aria-hidden />
              {streak > 0
                ? `${streak} day${streak === 1 ? "" : "s"} streak`
                : "Start your streak today"}
            </Badge>
            <Link
              href="/activities"
              className="text-sm font-medium text-primary hover:underline"
            >
              {checkedInToday ? "Find something else to earn" : "Claim your check-in"} →
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Current balance</p>
            <p className="mt-2 text-4xl font-bold text-coin">{formatCoins(user.balance)}</p>
          </div>
          <Link
            href="/wallet"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            View transaction history →
          </Link>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="mb-3 text-lg font-semibold">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/60"
            >
              <action.icon className="size-5 text-primary" aria-hidden />
              <p className="mt-2 font-semibold">{action.label}</p>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent activity + side summary */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section
          aria-labelledby="recent-activity"
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="recent-activity" className="text-base font-semibold">
              Recent activity
            </h2>
            <Link
              href="/wallet"
              className="text-sm font-medium text-primary hover:underline"
            >
              Full history →
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity yet.{" "}
              <Link href="/activities" className="font-medium text-primary hover:underline">
                Complete your first activity
              </Link>{" "}
              to start earning AC.
            </p>
          ) : (
            <ol className="mt-2 divide-y divide-border">
              {recent.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={tx.created_at}>{formatRelativeTime(tx.created_at)}</time>
                      {" · balance "}
                      {formatCoins(tx.balance_after)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      tx.type === "credit" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "−"}
                    {formatCoins(tx.amount)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="notif-summary"
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" aria-hidden />
              <h2 id="notif-summary" className="text-base font-semibold">
                Notifications
              </h2>
              {unreadCount > 0 && <Badge variant="default">{unreadCount} unread</Badge>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {unreadCount > 0
                ? `You have ${formatNumber(unreadCount)} unread notification${unreadCount === 1 ? "" : "s"}.`
                : "You are all caught up."}
            </p>
            <Link
              href="/notifications"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Open notifications →
            </Link>
          </section>

          <section
            aria-labelledby="referral-summary"
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" aria-hidden />
              <h2 id="referral-summary" className="text-base font-semibold">
                Referrals
              </h2>
            </div>
            <p className="mt-2 text-2xl font-bold">{formatNumber(referralCount)}</p>
            <p className="text-sm text-muted-foreground">
              member{referralCount === 1 ? "" : "s"} joined with your link
            </p>
            <Link
              href="/referrals"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              See your referral link →
            </Link>
          </section>
        </div>
      </div>

      {/* Available activities preview */}
      <section aria-labelledby="available-activities">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="available-activities" className="text-lg font-semibold">
            Available activities
          </h2>
          <Link href="/activities" className="text-sm font-medium text-primary hover:underline">
            See all →
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activities are enabled right now — check back soon.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {activities.map((activity) => (
                <li key={activity.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{activity.title}</p>
                    {activity.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {activity.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="coin">
                    {activity.reward_amount > 0 ? formatCoins(activity.reward_amount) : "Varies"}
                  </Badge>
                  <Link
                    href="/activities"
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    Open →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
