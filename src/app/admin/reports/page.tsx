import Link from "next/link";
import { Flag, ShieldAlert } from "lucide-react";
import { ReportRowActions } from "@/components/admin/report-row-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireModerator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContentReport, ContentStatus, ContentType } from "@/lib/database.types";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES: ContentReport["status"][] = ["open", "reviewing", "resolved", "dismissed"];

const STATUS_VARIANT: Record<ContentReport["status"], "warning" | "default" | "success" | "muted"> = {
  open: "warning",
  reviewing: "default",
  resolved: "success",
  dismissed: "muted",
};

const STATUS_LABEL: Record<ContentReport["status"], string> = {
  open: "Open",
  reviewing: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

function pick(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

type ReportListItem = {
  report: ContentReport;
  content: { id: string; title: string; slug: string; status: ContentStatus; type: ContentType } | null;
  reporterName: string;
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireModerator();
  const params = await searchParams;
  const statusParam = pick(params.status);
  const statusFilter = STATUSES.includes(statusParam as ContentReport["status"])
    ? (statusParam as ContentReport["status"])
    : undefined;

  const supabase = await createClient();

  let items: ReportListItem[] = [];
  let loadError: string | null = null;

  if (supabase) {
    let query = supabase.from("content_reports").select("*");
    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
    if (error) {
      loadError = error.message;
    } else {
      const reports = data ?? [];
      const contentIds = Array.from(new Set(reports.map((report) => report.content_id)));
      const reporterIds = Array.from(new Set(reports.map((report) => report.reporter_id)));

      const [contentRes, reportersRes] = await Promise.all([
        supabase
          .from("content")
          .select("id, title, slug, status, type")
          .in("id", contentIds.length ? contentIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", reporterIds.length ? reporterIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);

      const contentById = new Map((contentRes.data ?? []).map((row) => [row.id, row]));
      const reporterById = new Map(
        (reportersRes.data ?? []).map((profile) => [
          profile.id,
          profile.display_name ?? profile.username ?? "Unknown member",
        ]),
      );

      items = reports.map((report) => ({
        report,
        content: contentById.get(report.content_id) ?? null,
        reporterName: reporterById.get(report.reporter_id) ?? "Unknown member",
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Moderation queue for member-reported content. Every decision is written to the audit log.
        </p>
      </div>

      {!supabase && (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>The moderation queue becomes available once the project is connected.</AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Failed to load reports</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Filter reports by status">
        <FilterChip href="/admin/reports" active={!statusFilter}>
          All
        </FilterChip>
        {STATUSES.map((status) => (
          <FilterChip key={status} href={`/admin/reports?status=${status}`} active={statusFilter === status}>
            {STATUS_LABEL[status]}
          </FilterChip>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {statusFilter ? `No ${statusFilter} reports.` : "The queue is empty — nothing needs review."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(({ report, content, reporterName }) => (
            <Card key={report.id}>
              <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Flag className="size-4 text-destructive" aria-hidden />
                    <Badge variant="outline" className="uppercase">
                      {report.reason}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[report.status]}>{STATUS_LABEL[report.status]}</Badge>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(report.created_at)}</span>
                  </div>

                  {content ? (
                    <div>
                      <Link
                        href={`/admin/content/${content.id}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {content.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        /{content.slug}
                        <Badge variant="outline">{content.type}</Badge>
                        <Badge variant="muted">{content.status}</Badge>
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground">Reported content was deleted.</p>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Reported by {reporterName} on {formatDate(report.created_at)}.
                  </p>
                  {report.details && (
                    <p className="rounded-lg bg-muted p-3 text-sm">{report.details}</p>
                  )}
                </div>

                <div className="md:border-l md:border-border md:pl-4">
                  <ReportRowActions reportId={report.id} contentId={report.content_id} status={report.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
