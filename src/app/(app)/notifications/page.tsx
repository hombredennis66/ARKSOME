import Link from "next/link";
import { Bell, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cn, formatNumber, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { MarkAllReadButton, MarkReadButton } from "@/components/dashboard/notification-buttons";
import type { AppNotification } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const MAX_NOTIFICATIONS = 50;

/** Only same-site relative links are rendered (never javascript: URLs). */
function safeHref(href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\")) return href;
  return null;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;

  const user = await requireUser("/notifications");

  const [notificationsRes, unreadRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(MAX_NOTIFICATIONS),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  const notifications: AppNotification[] = notificationsRes.data ?? [];
  const unreadCount = unreadRes.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="default">{formatNumber(unreadCount)} unread</Badge>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">
            Reward updates, referrals and platform news.
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">No notifications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When you earn AC or a referral is credited, it will show up here.
          </p>
          <Link
            href="/activities"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Browse activities →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => {
            const isUnread = notification.read_at === null;
            const href = safeHref(notification.href);
            return (
              <li
                key={notification.id}
                className={cn(
                  "flex flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-4",
                  isUnread && "border-primary/20 bg-primary/5",
                )}
              >
                {isUnread && (
                  <span
                    className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                    aria-label="Unread"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Bell className="size-4 shrink-0 text-primary" aria-hidden />
                    <p className="font-medium">{notification.title}</p>
                    {!isUnread && (
                      <Badge variant="muted">
                        <span className="sr-only">Status: </span>Read
                      </Badge>
                    )}
                  </div>
                  {notification.body && (
                    <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <time dateTime={notification.created_at}>
                      {formatRelativeTime(notification.created_at)}
                    </time>
                    {href && (
                      <Link href={href} className="font-medium text-primary hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                </div>
                {isUnread && <MarkReadButton id={notification.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
