import { TaskMonitor, type TaskReviewRow } from "@/components/admin/task-monitor";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/database.types";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function TaskMonitorPage({ searchParams }: { searchParams: Promise<{ task?: string; member?: string; status?: string; from?: string; to?: string; page?: string }> }) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const status = ["pending", "approved", "rejected"].includes(params.status ?? "") ? params.status! : "";
  const taskId = params.task ?? "";
  const member = (params.member ?? "").trim().slice(0, 80);

  const [
    taskResult,
    taskCount,
    allCount,
    pendingCount,
    approvedCount,
    rejectedCount,
  ] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("tasks").select("id", { count: "exact", head: true }),
    supabase.from("task_submissions").select("id", { count: "exact", head: true }),
    supabase.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "rejected"),
  ]);
  const initialError = [
    taskResult.error,
    taskCount.error,
    allCount.error,
    pendingCount.error,
    approvedCount.error,
    rejectedCount.error,
  ].find(Boolean);
  if (initialError) {
    return (
      <div role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Could not load task monitor data: {initialError.message}
      </div>
    );
  }
  const tasks = (taskResult.data ?? []) as Task[];
  let memberIds: string[] | null = null;
  if (member) {
    if (/^[0-9a-f-]{36}$/i.test(member)) memberIds = [member];
    else {
      const [usernameResult, nameResult] = await Promise.all([
        supabase.from("profiles").select("id").ilike("username", `%${member}%`).limit(100),
        supabase.from("profiles").select("id").ilike("display_name", `%${member}%`).limit(100),
      ]);
      if (usernameResult.error || nameResult.error) {
        return (
          <div role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            Could not search members:{" "}
            {usernameResult.error?.message ?? nameResult.error?.message}
          </div>
        );
      }
      memberIds = Array.from(
        new Set([
          ...(usernameResult.data ?? []).map((row) => row.id),
          ...(nameResult.data ?? []).map((row) => row.id),
        ])
      );
    }
  }

  let query = supabase.from("task_submissions").select("id,task_id,user_id,status,submitted_at,reward_amount_snapshot,review_note", { count: "exact" }).order("submitted_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (taskId) query = query.eq("task_id", taskId);
  if (memberIds) query = memberIds.length ? query.in("user_id", memberIds) : query.eq("user_id", "00000000-0000-0000-0000-000000000000");
  if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) query = query.gte("submitted_at", `${params.from}T00:00:00.000Z`);
  if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
    const endExclusive = new Date(`${params.to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    query = query.lt("submitted_at", endExclusive.toISOString());
  }
  const { data: submissionData, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) {
    return (
      <div role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Could not load completions: {error.message}
      </div>
    );
  }
  const submissions = submissionData ?? [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const userIds = Array.from(new Set(submissions.map((submission) => submission.user_id)));
  const taskIds = Array.from(new Set(submissions.map((submission) => submission.task_id)));
  const [profileResult, taskLookup] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id,username,display_name").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    taskIds.some((id) => !taskById.has(id)) ? supabase.from("tasks").select("*").in("id", taskIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const profiles = profileResult.data;
  if (profileResult.error || taskLookup.error) {
    return (
      <div role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Could not load member or task details:{" "}
        {profileResult.error?.message ?? taskLookup.error?.message}
      </div>
    );
  }
  for (const task of taskLookup.data ?? []) taskById.set(task.id, task as Task);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const rows: TaskReviewRow[] = submissions.map((submission) => {
    const profile = profileById.get(submission.user_id);
    return {
      ...submission,
      task_title: taskById.get(submission.task_id)?.title ?? "Task",
      member_name: profile?.display_name ?? profile?.username ?? submission.user_id,
      username: profile?.username ?? null,
    };
  });
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const stats = [
    ["Total tasks", taskCount.count ?? 0],
    ["Member completions", allCount.count ?? 0],
    ["Pending reviews", pendingCount.count ?? 0],
    ["Approved", approvedCount.count ?? 0],
    ["Rejected", rejectedCount.count ?? 0],
  ] as const;

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold tracking-tight">Task monitor</h1><p className="mt-1 text-sm text-muted-foreground">Review each member completion separately. New submissions refresh here automatically.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{stats.map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div>
    <form method="get" className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
      <div><Label htmlFor="filter-task">Task</Label><Select id="filter-task" name="task" defaultValue={taskId}><option value="">All tasks</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</Select></div>
      <div><Label htmlFor="filter-member">Member</Label><Input id="filter-member" name="member" defaultValue={member} placeholder="Name, username, or ID" /></div>
      <div><Label htmlFor="filter-status">Status</Label><Select id="filter-status" name="status" defaultValue={status}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Select></div>
      <div><Label htmlFor="filter-from">Submitted from</Label><Input id="filter-from" name="from" type="date" defaultValue={params.from ?? ""} /></div>
      <div><Label htmlFor="filter-to">Submitted to</Label><Input id="filter-to" name="to" type="date" defaultValue={params.to ?? ""} /></div>
      <div className="flex items-end gap-2"><Button type="submit">Filter</Button><a href="/admin/tasks/monitor" className="inline-flex h-10 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-muted">Clear</a></div>
    </form>
    <TaskMonitor rows={rows} tasks={tasks} page={page} pageCount={pageCount} />
  </div>;
}
