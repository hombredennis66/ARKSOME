import Link from "next/link";
import {
  Clock,
  Coins,
  FileText,
  Flag,
  Gift,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Stat = {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  href?: string;
};

const today = new Date().toISOString().slice(0, 10);
const todayStartIso = new Date(`${today}T00:00:00.000Z`).toISOString();

export default async function AdminOverviewPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  let stats: Stat[] = [];
  let recentLogs: {
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    created_at: string;
  }[] = [];
  let actorNames = new Map<string, string>();
  let loadError: string | null = null;

  if (supabase) {
    const [
      membersRes,
      publishedRes,
      pendingRes,
      openReportsRes,
      eventsTodayRes,
      issuedRes,
      logsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("content").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("content").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase
        .from("reward_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStartIso),
      supabase.from("reward_events").select("amount").eq("status", "granted").gte("created_at", todayStartIso),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
    ]);

    const firstError =
      membersRes.error ??
      publishedRes.error ??
      pendingRes.error ??
      openReportsRes.error ??
      eventsTodayRes.error ??
      issuedRes.error ??
      logsRes.error;
    if (firstError) loadError = firstError.message;

    const coinsIssuedToday = (issuedRes.data ?? []).reduce((sum, row) => sum + row.amount, 0);
    recentLogs = logsRes.data ?? [];

    const actorIds = Array.from(
      new Set(recentLogs.map((log) => log.actor_id).filter((id): id is string => Boolean(id))),
    );
    if (actorIds.length) {
      const { data: actors } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", actorIds);
      actorNames = new Map(
        (actors ?? []).map((profile) => [profile.id, profile.display_name ?? profile.username ?? "Unknown"]),
      );
    }

    stats = [
      {
        label: "Total members",
        value: formatNumber(membersRes.count ?? 0),
        hint: "Registered accounts",
        icon: Users,
        href: "/admin/users",
      },
      {
        label: "Published content",
        value: formatNumber(publishedRes.count ?? 0),
        hint: "Live in the feed",
        icon: FileText,
        href: "/admin/content?status=published",
      },
      {
        label: "Pending content",
        value: formatNumber(pendingRes.count ?? 0),
        hint: "Awaiting review",
        icon: Clock,
        href: "/admin/content?status=pending",
      },
      {
        label: "Open reports",
        value: formatNumber(openReportsRes.count ?? 0),
        hint: "Awaiting moderation",
        icon: Flag,
        href: "/admin/reports?status=open",
      },
      {
        label: "Coins issued today",
        value: `${formatNumber(coinsIssuedToday)} AC`,
        hint: "Granted reward events (UTC day)",
        icon: Coins,
        href: "/admin/rewards",
      },
      {
        label: "Reward events today",
        value: formatNumber(eventsTodayRes.count ?? 0),
        hint: "Granted and rejected",
        icon: Gift,
        href: "/admin/audit-logs",
      },
    ];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {user.displayName ?? user.username ?? user.email ?? "operator"}.
        </p>
      </div>

      {!supabase && (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add your project keys to <code className="font-mono">.env.local</code> and run the
            migrations to see live platform statistics.
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Some statistics failed to load</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <section aria-label="Platform statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.length === 0
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Statistics unavailable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">—</p>
                </CardContent>
              </Card>
            ))
          : stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <stat.icon className="size-4 text-primary" aria-hidden />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
                  {stat.href && (
                    <Link
                      href={stat.href}
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      Open →
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
      </section>

      <section aria-label="Recent audit activity">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent audit logs</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Every privileged change is recorded with its actor.
              </p>
            </div>
            <Link href="/admin/audit-logs" className="text-sm font-medium text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No audit entries yet. Actions taken in this console will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentLogs.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{log.action}</code>
                    <span className="text-sm text-muted-foreground">
                      {actorNames.get(log.actor_id ?? "") ?? "system"}
                      {log.target_type ? ` → ${log.target_type}` : ""}
                      {log.target_id ? ` (${log.target_id.slice(0, 8)}…)` : ""}
                    </span>
                    <Badge variant="muted" className="ml-auto">
                      {formatRelativeTime(log.created_at)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
