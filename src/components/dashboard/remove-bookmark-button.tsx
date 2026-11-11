"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { removeBookmark } from "@/lib/actions/bookmarks";

/** Removes one item from the member's saved list (server revalidates the page). */
export function RemoveBookmarkButton({ contentId, title }: { contentId: string; title: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeBookmark(contentId);
      if (!result.ok) setError("Could not remove this item — please try again.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRemove}
        disabled={pending}
        aria-label={`Remove ${title} from saved items`}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <X className="size-3.5" aria-hidden />}
        {pending ? "Removing…" : "Remove"}
      </button>
      <span aria-live="polite" className="text-xs text-destructive">
        {error ?? ""}
      </span>
    </div>
  );
}
