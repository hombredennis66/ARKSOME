import Link from "next/link";
import { ScrollText, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog } from "@/lib/database.types";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function pick(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const actionFilter = (pick(params.action) ?? "").replace(/[%_]/g, "").trim().slice(0, 60);
  const pageRaw = Number.parseInt(pick(params.page) ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const service = getServiceClient();

  let logs: AuditLog[] = [];
  let total = 0;
  let loadError: string | null = null;
  let actorInfo = new Map<string, { name: string; email: string | null }>();

  if (supabase) {
    let query = supabase.from("audit_logs").select("*", { count: "exact" });
    if (actionFilter) query = query.ilike("action", `%${actionFilter}%`);

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      loadError = error.message;
    } else {
      logs = data ?? [];
      total = count ?? logs.length;

      const actorIds = Array.from(
        new Set(logs.map((log) => log.actor_id).filter((id): id is string => Boolean(id))),
      );

      const names = new Map<string, string>();
      if (actorIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", actorIds);
        for (const profile of profiles ?? []) {
          names.set(profile.id, profile.display_name ?? profile.username ?? "Unknown");
        }
      }

      // Emails live in Supabase Auth — only readable with the service key.
      const emails = new Map<string, string>();
      if (service && actorIds.length) {
        const results = await Promise.all(
          actorIds.map(async (id) => {
            const result = await service.auth.admin.getUserById(id);
            const email = !result.error && result.data?.user?.email ? result.data.user.email : null;
            return { id, email };
          }),
        );
        for (const result of results) {
          if (result.email) emails.set(result.id, result.email);
        }
      }

      actorInfo = new Map(
        actorIds.map((id) => [id, { name: names.get(id) ?? "Unknown", email: emails.get(id) ?? null }]),
      );
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const querySuffix = actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Newest first. Every privileged action records its actor, target and metadata.
        </p>
      </div>

      {!supabase && (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Audit logs become available once the project is connected.</AlertDescription>
        </Alert>
      )}

      {supabase && !service && (
        <Alert variant="info">
          <AlertDescription>
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is not set, so actor email
            addresses are not shown (names are still resolved from profiles).
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Failed to load audit logs</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <form method="get" action="/admin/audit-logs" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-56 flex-1">
          <Label htmlFor="action-filter" className="mb-1.5 block text-xs text-muted-foreground">
            Filter by action
          </Label>
          <Input
            id="action-filter"
            type="search"
            name="action"
            defaultValue={actionFilter}
            placeholder="e.g. role_change, content_update…"
            className="h-9"
          />
        </div>
        <Button type="submit" size="sm" className="h-9">
          <Search className="size-4" />
          Apply
        </Button>
        {actionFilter && (
          <Link href="/admin/audit-logs" className="text-sm font-medium text-primary hover:underline">
            Clear
          </Link>
        )}
      </form>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Entries</CardTitle>
          {total > 0 && (
            <span className="text-sm text-muted-foreground">
              {total.toLocaleString()} total · page {page} of {totalPages}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <ScrollText className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {actionFilter ? `No actions match “${actionFilter}”.` : "No audit entries recorded yet."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((log) => {
                const actor = log.actor_id ? actorInfo.get(log.actor_id) : undefined;
                return (
                  <li key={log.id} className="grid gap-2 py-4 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{formatDate(log.created_at)}</p>
                      <p>{formatRelativeTime(log.created_at)}</p>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{log.action}</code>
                        {log.target_type && (
                          <Badge variant="outline">
                            {log.target_type}
                            {log.target_id ? ` · ${log.target_id.slice(0, 8)}…` : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Actor:{" "}
                        {actor ? (
                          <>
                            <span className="font-medium text-foreground">{actor.name}</span>
                            {actor.email && <span className="break-all"> · {actor.email}</span>}
                            <span className="break-all"> · {log.actor_id?.slice(0, 8)}…</span>
                          </>
                        ) : (
                          <span>{log.actor_id ? `system / unknown (${log.actor_id.slice(0, 8)}…)` : "system"}</span>
                        )}
                      </p>
                      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 text-xs leading-relaxed">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm" aria-label="Pagination">
              {page > 1 ? (
                <Link
                  href={`/admin/audit-logs?page=${page - 1}${querySuffix}`}
                  className="font-medium text-primary hover:underline"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="text-muted-foreground">← Previous</span>
              )}
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/admin/audit-logs?page=${page + 1}${querySuffix}`}
                  className={cn("font-medium text-primary hover:underline")}
                >
                  Next →
                </Link>
              ) : (
                <span className="text-muted-foreground">Next →</span>
              )}
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
