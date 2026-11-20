import { Badge } from "@/components/ui/badge";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { SubmitTaskButton } from "@/components/tasks/submit-task-button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatAC } from "@/lib/utils";
import type { Task, TaskSubmission } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function state(task: Task, now: number): "upcoming" | "closed" | "available" {
  if (task.starts_at && new Date(task.starts_at).getTime() > now) return "upcoming";
  if (task.deadline && new Date(task.deadline).getTime() < now) return "closed";
  return "available";
}

export default async function TasksPage() {
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;
  const user = await requireUser("/tasks");
  const [{ data: tasksData, error: tasksError }, { data: submissionsData, error: submissionsError }] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("task_submissions").select("*").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1000),
  ]);
  const tasks = (tasksData ?? []) as Task[];
  const submissions = (submissionsData ?? []) as TaskSubmission[];
  const byTask = new Map(submissions.map((item) => [item.task_id, item]));
  const now = new Date().getTime();
  const catalogue = tasks.filter((task) => task.status === "active");

  return <div className="space-y-8">
    <header><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Complete available tasks and track each review. AC is awarded only after approval.</p></header>
    {(tasksError || submissionsError) && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Tasks could not be fully loaded. Refresh the page to try again.</p>}
    <section aria-labelledby="task-catalogue"><h2 id="task-catalogue" className="mb-3 text-lg font-semibold">Available tasks</h2>
      {catalogue.length === 0 ? <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">No tasks are available right now. Check back soon.</p> : <ul className="grid gap-4 md:grid-cols-2">{catalogue.map((task) => {
        const submission = byTask.get(task.id);
        const availability = state(task, now);
        return <li key={task.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{task.title}</h3><Badge variant="coin">{formatAC(task.reward_amount)}</Badge></div>
          {task.description && <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>}
          {task.instructions && <div className="mt-3 rounded-lg bg-muted p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instructions</p><p className="mt-1 whitespace-pre-wrap text-sm">{task.instructions}</p></div>}
          <p className="mt-3 text-xs text-muted-foreground">{task.starts_at ? `Starts ${new Date(task.starts_at).toLocaleString()}` : "Available now"}{task.deadline ? ` · Deadline ${new Date(task.deadline).toLocaleString()}` : " · No deadline"}</p>
          <div className="mt-4">{submission ? <Badge variant={submission.status === "approved" ? "success" : submission.status === "rejected" ? "destructive" : "warning"}>{submission.status}</Badge> : <SubmitTaskButton taskId={task.id} disabled={availability !== "available"} />}
            {availability === "upcoming" && !submission && <p className="mt-2 text-xs text-muted-foreground">This task has not started yet.</p>}
            {availability === "closed" && !submission && <p className="mt-2 text-xs text-muted-foreground">The deadline has passed.</p>}
          </div>
        </li>;
      })}</ul>}
    </section>
    <section aria-labelledby="task-history"><h2 id="task-history" className="mb-3 text-lg font-semibold">Completion history</h2>
      {submissions.length === 0 ? <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">You have not submitted any tasks yet.</p> : <ul className="divide-y divide-border rounded-xl border border-border bg-card px-5">{submissions.map((submission) => {
        const task = tasks.find((item) => item.id === submission.task_id);
        return <li key={submission.id} className="flex flex-wrap items-center justify-between gap-2 py-4"><div><p className="font-medium">{task?.title ?? "Task"}</p><p className="text-xs text-muted-foreground">Submitted {new Date(submission.submitted_at).toLocaleString()} · {formatAC(submission.reward_amount_snapshot)}</p></div><Badge variant={submission.status === "approved" ? "success" : submission.status === "rejected" ? "destructive" : "warning"}>{submission.status}</Badge></li>;
      })}</ul>}
    </section>
  </div>;
}
