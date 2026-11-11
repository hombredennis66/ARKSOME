"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { FeedItem } from "@/lib/feed";
import { FeedCard } from "./feed-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const FILTERS = [
  { key: "", label: "Everything" },
  { key: "article", label: "Articles" },
  { key: "video", label: "Videos" },
  { key: "community", label: "Community" },
] as const;

export function FeedList({
  initialItems,
  initialCursor,
  bookmarkedIds,
  canSave,
}: {
  initialItems: FeedItem[];
  initialCursor: string | null;
  bookmarkedIds: string[];
  canSave: boolean;
}) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookmarks = new Set(bookmarkedIds);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (filter) params.set("type", filter);

      const res = await fetch(`/api/feed?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const page: { items: FeedItem[]; nextCursor: string | null } = await res.json();

      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more posts.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, filter]);

  // Infinite scroll: load the next page when the sentinel enters the viewport.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  async function applyFilter(key: string) {
    setFilter(key);
    setItems([]);
    setCursor(null);
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (key) params.set("type", key);
      const res = await fetch(`/api/feed?${params.toString()}`, { cache: "no-store" });
      const page: { items: FeedItem[]; nextCursor: string | null } = await res.json();
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch {
      setError("Could not load that filter.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="Discovery feed">
      <div className="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter feed">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => applyFilter(f.key)}
            className={
              filter === f.key
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5">
        {items.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            canSave={canSave}
            bookmarked={bookmarks.has(item.id)}
            showRewardHint={canSave}
          />
        ))}

        {loading && (
          <div className="grid gap-5" aria-hidden>
            {[0, 1].map((n) => (
              <div key={n} className="overflow-hidden rounded-xl border border-border bg-card">
                <Skeleton className="aspect-[16/9] w-full rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadMore()}>
              <RefreshCw className="size-4" /> Try again
            </Button>
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-medium">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different filter — new posts are published every day.
            </p>
          </div>
        )}
      </div>

      <div ref={sentinelRef} className="flex items-center justify-center py-8" aria-hidden>
        {loading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      </div>

      {cursor && !loading && !error && (
        <div className="flex justify-center pb-6">
          <Button variant="outline" onClick={() => void loadMore()}>
            Load more posts
          </Button>
        </div>
      )}

      {!cursor && items.length > 0 && (
        <p className="pb-8 text-center text-sm text-muted-foreground">You have reached the end.</p>
      )}
    </section>
  );
}
