import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TasksManager } from "@/components/admin/tasks-manager";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(500);
  const tasks = (data ?? []) as Task[];
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Task management</h1><p className="mt-1 text-sm text-muted-foreground">Create, publish, edit, and disable member tasks.</p></div><Link href="/admin/tasks/monitor" className="inline-flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted">Task monitor <ArrowUpRight className="size-4" /></Link></header>
    {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Could not load tasks. {error.message}</p>}
    <TasksManager tasks={tasks} />
  </div>;
}
