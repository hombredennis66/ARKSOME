import Link from "next/link";
import { FilePlus2, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import type { ContentStatus, ContentType } from "@/lib/database.types";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES: ContentStatus[] = ["draft", "pending", "published", "rejected", "removed"];
const TYPES: ContentType[] = ["article", "video", "short", "community"];
const LIMIT = 100;

const STATUS_VARIANT: Record<ContentStatus, "muted" | "warning" | "success" | "destructive" | "outline"> = {
  draft: "muted",
  pending: "warning",
  published: "success",
  rejected: "destructive",
  removed: "outline",
};

function pick(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = pick(params.status);
  const type = pick(params.type);
  const statusFilter = STATUSES.includes(status as ContentStatus) ? (status as ContentStatus) : undefined;
  const typeFilter = TYPES.includes(type as ContentType) ? (type as ContentType) : undefined;

  const supabase = await createClient();

  let rows: {
    id: string;
    slug: string;
    title: string;
    type: ContentType;
    status: ContentStatus;
    is_sponsored: boolean;
    sponsor_name: string | null;
    view_count: number;
    updated_at: string;
    published_at: string | null;
    author_id: string | null;
  }[] = [];
  let authorNames = new Map<string, string>();
  let loadError: string | null = null;

  if (supabase) {
    let query = supabase
      .from("content")
      .select(
        "id, slug, title, type, status, is_sponsored, sponsor_name, view_count, updated_at, published_at, author_id",
      );
    if (statusFilter) query = query.eq("status", statusFilter);
    if (typeFilter) query = query.eq("type", typeFilter);

    const { data, error } = await query.order("updated_at", { ascending: false }).limit(LIMIT);
    if (error) loadError = error.message;
    rows = data ?? [];

    const authorIds = Array.from(
      new Set(rows.map((row) => row.author_id).filter((id): id is string => Boolean(id))),
    );
    if (authorIds.length) {
      const { data: authors } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", authorIds);
      authorNames = new Map(
        (authors ?? []).map((profile) => [profile.id, profile.display_name ?? profile.username ?? "Unknown"]),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every article, video, short and community post — whatever its status.
          </p>
        </div>
        <Link href="/admin/content/new">
          <Button>
            <FilePlus2 className="size-4" />
            New content
          </Button>
        </Link>
      </div>

      {!supabase && (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Content management becomes available once the project is connected.</AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Failed to load content</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <form method="get" action="/admin/content" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-40">
          <Label htmlFor="filter-status" className="mb-1.5 block text-xs text-muted-foreground">
            Status
          </Label>
          <Select id="filter-status" name="status" defaultValue={statusFilter ?? ""} className="h-9">
            <option value="">All statuses</option>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-40">
          <Label htmlFor="filter-type" className="mb-1.5 block text-xs text-muted-foreground">
            Type
          </Label>
          <Select id="filter-type" name="type" defaultValue={typeFilter ?? ""} className="h-9">
            <option value="">All types</option>
            {TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm" className="h-9">
          Apply filters
        </Button>
        {(statusFilter || typeFilter) && (
          <Link href="/admin/content" className="text-sm font-medium text-primary hover:underline">
            Clear
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <FileText className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {statusFilter || typeFilter
                  ? "No content matches these filters."
                  : "No content yet — create the first item."}
              </p>
              <Link href="/admin/content/new" className="text-sm font-medium text-primary hover:underline">
                Create content →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Author</th>
                    <th className="px-4 py-3 font-semibold">Views</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 font-semibold" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/40">
                      <td className="max-w-72 px-4 py-3">
                        <Link
                          href={`/admin/content/${row.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {row.title}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">/{row.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{row.type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                          {row.is_sponsored && (
                            <Badge variant="sponsored">sponsored{row.sponsor_name ? ` · ${row.sponsor_name}` : ""}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.author_id ? (authorNames.get(row.author_id) ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.view_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(row.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/content/${row.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Edit →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === LIMIT && (
                <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  Showing the first {LIMIT} items — use the filters to narrow the list.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
