import { NextResponse, type NextRequest } from "next/server";
import { fetchFeed, FEED_PAGE_SIZE } from "@/lib/feed";
import type { ContentType } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const VALID_TYPES: ContentType[] = ["article", "video", "short", "community"];

/**
 * Cursor-paginated feed endpoint used by infinite scroll.
 * GET /api/feed?cursor=<opaque>&type=video
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const cursor = params.get("cursor");
  const rawType = params.get("type");
  const type = rawType && VALID_TYPES.includes(rawType as ContentType) ? (rawType as ContentType) : null;

  try {
    const page = await fetchFeed({ cursor, type, limit: FEED_PAGE_SIZE });
    return NextResponse.json(page, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[api/feed]", error);
    return NextResponse.json({ items: [], nextCursor: null, demo: false }, { status: 500 });
  }
}
