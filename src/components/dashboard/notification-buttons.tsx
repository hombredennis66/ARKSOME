"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { markAllRead, markNotificationRead } from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";

/** Marks one notification as read; the server action revalidates the list. */
export function MarkReadButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleMark() {
    setError(null);
    startTransition(async () => {
      const result = await markNotificationRead(id);
      if (!result.ok) setError(result.error ?? "Could not update this notification.");
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleMark} disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Marking…" : "Mark as read"}
      </Button>
      <span aria-live="polite" className="text-xs text-destructive">
        {error ?? ""}
      </span>
    </span>
  );
}

/** Marks every unread notification as read. */
export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleMarkAll() {
    setError(null);
    startTransition(async () => {
      const result = await markAllRead();
      if (!result.ok) setError(result.error ?? "Could not update notifications.");
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={pending || disabled}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        {pending ? "Marking…" : "Mark all as read"}
      </Button>
      <span aria-live="polite" className="text-xs text-destructive">
        {error ?? ""}
      </span>
    </span>
  );
}
