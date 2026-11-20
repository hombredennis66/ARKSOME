"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { adminReviewTaskSubmission } from "@/lib/actions/tasks";
import type { Task } from "@/lib/database.types";

export type TaskReviewRow = {
  id: string;
  task_id: string;
  user_id: string;
  status: string;
  submitted_at: string;
  reward_amount_snapshot: number;
  review_note: string | null;
  task_title: string;
  member_name: string;
  username: string | null;
};

export function TaskMonitor({ rows, tasks, page, pageCount }: { rows: TaskReviewRow[]; tasks: Task[]; page: number; pageCount: number }) {
  const router = useRouter();
  const { run, pending, feedback } = useAdminAction();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel("admin-task-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "task_submissions" }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router]);

  async function review(id: string, decision: "approved" | "rejected", note: string) {
    await run(() => adminReviewTaskSubmission(id, decision, note));
  }

  return <div className="space-y-4">
    <ActionFeedback feedback={feedback} />
    {rows.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No completion records match these filters.</div> : (
      <ul className="space-y-3">{rows.map((row) => <SubmissionCard key={row.id} row={row} pending={pending} onReview={review} />)}</ul>
    )}
    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span><div className="flex gap-2">
      <Button variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</Button>
      <Button variant="outline" disabled={page >= pageCount} onClick={() => changePage(page + 1)}>Next</Button>
    </div></div>
    <datalist id="task-filter-options">{tasks.map((task) => <option key={task.id} value={task.title} />)}</datalist>
  </div>;
}

function changePage(page: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("page", String(page));
  window.location.assign(url.toString());
}

function SubmissionCard({ row, pending, onReview }: { row: TaskReviewRow; pending: boolean; onReview: (id: string, decision: "approved" | "rejected", note: string) => void }) {
  const [busy, startTransition] = useTransition();
  const statusVariant = row.status === "approved" ? "success" : row.status === "rejected" ? "destructive" : "warning";
  return <li className="rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <h2 className="font-semibold">{row.task_title}</h2>
      <p className="mt-1 text-sm">{row.member_name}{row.username ? <span className="text-muted-foreground"> · @{row.username}</span> : null}</p>
      <p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(row.submitted_at).toLocaleString()} · {row.reward_amount_snapshot} AC</p>
    </div><Badge variant={statusVariant}>{row.status}</Badge></div>
    {row.review_note && <p className="mt-3 rounded-md bg-muted p-3 text-sm">Review note: {row.review_note}</p>}
    {row.status === "pending" && <form className="mt-4 space-y-3" onSubmit={(event) => event.preventDefault()}>
      <textarea name="note" maxLength={1000} placeholder="Optional note for the member" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending || busy} onClick={(event) => { const note = (event.currentTarget.form?.elements.namedItem("note") as HTMLTextAreaElement | null)?.value ?? ""; startTransition(() => onReview(row.id, "approved", note)); }}>Approve and award AC</Button>
        <Button type="button" variant="destructive" disabled={pending || busy} onClick={(event) => { const note = (event.currentTarget.form?.elements.namedItem("note") as HTMLTextAreaElement | null)?.value ?? ""; startTransition(() => onReview(row.id, "rejected", note)); }}>Reject</Button>
      </div>
    </form>}
  </li>;
}
