"use client";

import { useTransition, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleBookmark } from "@/lib/actions/bookmarks";

export function BookmarkButton({
  contentId,
  initialBookmarked,
  className,
}: {
  contentId: string;
  initialBookmarked: boolean;
  className?: string;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !bookmarked;
    setBookmarked(next); // optimistic update
    startTransition(async () => {
      const result = await toggleBookmark(contentId);
      if (!result.ok) setBookmarked(!next); // roll back on failure
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "Remove bookmark" : "Save for later"}
      title={bookmarked ? "Saved" : "Save for later"}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      }
    >
      {bookmarked ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
      <span className="hidden sm:inline">{bookmarked ? "Saved" : "Save"}</span>
    </button>
  );
}
