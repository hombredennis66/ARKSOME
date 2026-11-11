"use client";

import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { adminTogglePlacement } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

/** Enable/disable switch for a single ad placement. */
export function PlacementToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const { run, pending, feedback } = useAdminAction();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? "Disable placement" : "Enable placement"}
        disabled={pending}
        onClick={() => void run(() => adminTogglePlacement(id, !enabled))}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
          enabled ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-background shadow transition-transform",
            enabled ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
      <span className="text-xs font-medium text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
      <ActionFeedback feedback={feedback} />
    </div>
  );
}
