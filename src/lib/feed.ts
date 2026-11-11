import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_CONTENT } from "@/lib/demo-content";
import type { ContentType } from "@/lib/database.types";

export type FeedItem = {
  id: string;
  slug: string;
  type: ContentType;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  is_sponsored: boolean;
  sponsor_name: string | null;
  tags: string[];
  published_at: string | null;
  view_count: number;
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
  demo: boolean;
};

export const FEED_PAGE_SIZE = 6;

const SELECT_COLUMNS =
  "id, slug, type, title, excerpt, cover_url, video_url, duration_seconds, is_sponsored, sponsor_name, tags, published_at, view_count";

/** Opaque cursor: base64url of `${publishedAtMs}:{uuid}`. */
function encodeCursor(publishedAt: string, id: string) {
  const ms = new Date(publishedAt).getTime();
  return Buffer.from(`${ms}:${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { ms: number; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [ms, id] = raw.split(":");
    if (!ms || !id || Number.isNaN(Number(ms))) return null;
    return { ms: Number(ms), id };
  } catch {
    return null;
  }
}

/**
 * Cursor-published feed. Falls back to demo content when Supabase has not
 * been configured, so the UI is reviewable before credentials exist.
 */
export async function fetchFeed(options: {
  cursor?: string | null;
  limit?: number;
  type?: ContentType | null;
}): Promise<FeedPage> {
  const limit = Math.min(options.limit ?? FEED_PAGE_SIZE, 20);

  if (!isSupabaseConfigured) {
    const all = options.type ? DEMO_CONTENT.filter((c) => c.type === options.type) : DEMO_CONTENT;
    const start = options.cursor ? Number(Buffer.from(options.cursor, "base64url").toString("utf8")) : 0;
    const items = all.slice(start, start + limit) as FeedItem[];
    const nextIndex = start + limit;
    return {
      items,
      nextCursor: nextIndex < all.length ? Buffer.from(String(nextIndex)).toString("base64url") : null,
      demo: true,
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { items: [], nextCursor: null, demo: true };
  }

  let query = supabase
    .from("content")
    .select(SELECT_COLUMNS)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString());

  if (options.type) query = query.eq("type", options.type);

  const decoded = options.cursor ? decodeCursor(options.cursor) : null;
  if (decoded) {
    const iso = new Date(decoded.ms).toISOString().replace(/\.\d{3}Z$/, "Z");
    query = query.or(`published_at.lt.${iso},and(published_at.eq.${iso},id.lt.${decoded.id})`);
  }

  const { data, error } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (error || !data) {
    console.error("[feed] query failed:", error?.message);
    return { items: [], nextCursor: null, demo: false };
  }

  const hasMore = data.length > limit;
  const items = (hasMore ? data.slice(0, limit) : data) as unknown as FeedItem[];
  const last = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && last?.published_at ? encodeCursor(last.published_at, last.id) : null,
    demo: false,
  };
}

/** Single item lookup for the detail page. */
export async function fetchContentBySlug(slug: string): Promise<{ item: FeedItem & { body: string | null } } | null> {
  if (!isSupabaseConfigured) {
    const found = DEMO_CONTENT.find((c) => c.slug === slug);
    return found ? { item: found as FeedItem & { body: string | null } } : null;
  }

  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("content")
    .select("id, slug, type, title, excerpt, body, cover_url, video_url, duration_seconds, is_sponsored, sponsor_name, tags, published_at, view_count")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return { item: data as unknown as FeedItem & { body: string | null } };
}
