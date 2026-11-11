import Link from "next/link";
import Image from "next/image";
import { Bookmark, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { RemoveBookmarkButton } from "@/components/dashboard/remove-bookmark-button";
import type { Content } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type SavedRow = {
  content_id: string;
  created_at: string;
  content: Content | null;
};

const TYPE_LABEL: Record<string, string> = {
  article: "Article",
  video: "Video",
  short: "Short",
  community: "Community",
};

export default async function BookmarksPage() {
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;

  const user = await requireUser("/bookmarks");

  const { data } = await supabase
    .from("bookmarks")
    .select("content_id, created_at, content(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // The hand-written database types omit the bookmarks→content relationship,
  // so the embedded row is narrowed here after the (valid) PostgREST join.
  const rows = (data ?? []) as unknown as SavedRow[];
  const items = rows.filter(
    (row): row is SavedRow & { content: Content } => row.content !== null,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Saved content</h1>
        <p className="mt-1 text-muted-foreground">
          Everything you bookmarked from the feed, newest first.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Bookmark className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap “Save” on any post in the feed to keep it here for later.
          </p>
          <Link href="/" className={cn(buttonVariants({ variant: "default" }), "mt-4")}>
            Browse the feed
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map(({ content_id, created_at, content }) => (
            <li
              key={content_id}
              className="grid gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:p-5"
            >
              <Link
                href={`/content/${content.slug}`}
                className="relative block aspect-video w-full overflow-hidden rounded-lg bg-muted"
                tabIndex={-1}
                aria-hidden="true"
              >
                {content.cover_url ? (
                  <Image
                    src={content.cover_url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 220px"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No cover image
                  </span>
                )}
              </Link>

              <div className="flex min-w-0 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={content.type === "video" ? "default" : "secondary"}>
                    {TYPE_LABEL[content.type] ?? content.type}
                  </Badge>
                  {content.is_sponsored && (
                    <Badge variant="sponsored">
                      <Sparkles className="size-3" aria-hidden /> Sponsored
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Saved {formatRelativeTime(created_at)}
                  </span>
                </div>

                <h2 className="mt-2 text-lg font-semibold leading-snug">
                  <Link href={`/content/${content.slug}`} className="hover:text-primary">
                    {content.title}
                  </Link>
                </h2>

                {content.excerpt && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {content.excerpt}
                  </p>
                )}

                <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <Link
                    href={`/content/${content.slug}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Open →
                  </Link>
                  <RemoveBookmarkButton contentId={content_id} title={content.title} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
