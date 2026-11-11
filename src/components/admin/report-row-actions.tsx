"use client";

import { Eye, Check, XCircle, Trash2 } from "lucide-react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Button } from "@/components/ui/button";
import { adminRemoveContent, adminSetReportStatus } from "@/lib/actions/admin";
import type { ContentReport } from "@/lib/database.types";

/** Moderation actions for one content report. */
export function ReportRowActions({
  reportId,
  contentId,
  status,
}: {
  reportId: string;
  contentId: string;
  status: ContentReport["status"];
}) {
  const { run, pending, feedback } = useAdminAction();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status !== "reviewing" && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => void run(() => adminSetReportStatus(reportId, "reviewing"))}>
            <Eye className="size-3.5" />
            Mark reviewing
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void run(() => adminSetReportStatus(reportId, "resolved"))}>
          <Check className="size-3.5" />
          Resolve
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void run(() => adminSetReportStatus(reportId, "dismissed"))}>
          <XCircle className="size-3.5" />
          Dismiss
        </Button>
      </div>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          const confirmed = window.confirm(
            "Remove this content? It will be set to status “removed” and any open reports against it will be resolved.",
          );
          if (confirmed) void run(() => adminRemoveContent(contentId));
        }}
      >
        <Trash2 className="size-3.5" />
        Remove content
      </Button>
      <ActionFeedback feedback={feedback} />
    </div>
  );
}
