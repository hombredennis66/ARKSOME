"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Eye, Sparkles } from "lucide-react";
import type { FeedItem } from "@/lib/feed";
import { Badge } from "@/components/ui/badge";
import { VideoEmbed } from "./video-embed";
import { BookmarkButton } from "@/components/bookmark-button";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  article: "Article",
  video: "Video",
  short: "Short",
  community: "Community",
};

export function FeedCard({
  item,
  canSave,
  bookmarked,
  showRewardHint,
}: {
  item: FeedItem;
  canSave: boolean;
  bookmarked: boolean;
  showRewardHint?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <header className="flex items-start gap-2 px-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.type === "video" ? "default" : "secondary"}>{TYPE_LABEL[item.type] ?? item.type}</Badge>
          {item.is_sponsored && (
            <Badge variant="sponsored">
              <Sparkles className="size-3" /> Sponsored{item.sponsor_name ? ` · ${item.sponsor_name}` : ""}
            </Badge>
          )}
          {showRewardHint && (
            <Badge variant="coin" title="Opening this post may earn ARKSOME Coins">
              +2 AC
            </Badge>
          )}
        </div>
        <div className="ml-auto shrink-0">
          {canSave && <BookmarkButton contentId={item.id} initialBookmarked={bookmarked} />}
        </div>
      </header>

      {item.video_url ? (
        <div className="mt-3">
          <VideoEmbed src={item.video_url} poster={item.cover_url} title={item.title} duration={item.duration_seconds} />
        </div>
      ) : (
        item.cover_url && (
          <Link href={`/content/${item.slug}`} className="mt-3 block" tabIndex={-1} aria-hidden="true">
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
              <Image
                src={item.cover_url}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                className="object-cover transition-transform duration-300 hover:scale-[1.02]"
                loading="lazy"
              />
            </div>
          </Link>
        )
      )}

      <div className="flex flex-col gap-2 p-4 sm:p-5">
        <h2 className="text-lg font-semibold leading-snug">
          <Link href={`/content/${item.slug}`} className="hover:text-primary">
            {item.title}
          </Link>
        </h2>

        {item.excerpt && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.excerpt}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {item.published_at && (
            <time dateTime={item.published_at}>
              {new Date(item.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </time>
          )}
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" /> {item.view_count.toLocaleString()}
          </span>
          {item.duration_seconds ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {item.duration_seconds}s
            </span>
          ) : null}
          <Link
            href={`/content/${item.slug}`}
            className={cn(
              "ml-auto rounded-md px-2 py-1 font-medium text-primary hover:bg-primary/10",
            )}
          >
            Open →
          </Link>
        </div>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
