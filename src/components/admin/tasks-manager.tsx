"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { ActionFeedback } from "@/components/admin/action-feedback";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { adminSaveTask, type TaskInput } from "@/lib/actions/tasks";
import { formatAC } from "@/lib/utils";
import type { Task } from "@/lib/database.types";

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function TasksManager({ tasks }: { tasks: Task[] }) {
  const { run, pending, feedback } = useAdminAction();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const open = creating || editing !== null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value: TaskInput = {
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      instructions: String(data.get("instructions") ?? ""),
      reward_amount: Number(data.get("reward_amount")),
      status: String(data.get("status") ?? "draft"),
      starts_at: String(data.get("starts_at") ?? "") || null,
      deadline: String(data.get("deadline") ?? "") || null,
    };
    const result = await run(() => adminSaveTask(editing?.id ?? null, value));
    if (result.ok) { setEditing(null); setCreating(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Tasks</CardTitle><p className="mt-1 text-sm text-muted-foreground">Create tasks and manage availability. Existing completion records remain attached when a task is disabled.</p></div>
          <Button size="sm" disabled={pending || open} onClick={() => { setEditing(null); setCreating(true); }}><Plus className="size-4" /> New task</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActionFeedback feedback={feedback} />
          {tasks.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No tasks yet.</p> : (
            <ul className="divide-y divide-border">{tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-medium">{task.title}<Badge variant={task.status === "active" ? "success" : task.status === "draft" ? "muted" : "outline"}>{task.status}</Badge></p>
                  <p className="text-sm text-muted-foreground">{formatAC(task.reward_amount)} · {task.starts_at ? `starts ${new Date(task.starts_at).toLocaleString()}` : "available now"}{task.deadline ? ` · deadline ${new Date(task.deadline).toLocaleString()}` : ""}</p>
                  {task.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>}
                </div>
                <Button size="sm" variant="outline" disabled={pending || open} onClick={() => { setCreating(false); setEditing(task); }}><Pencil className="size-3.5" /> Edit</Button>
              </li>
            ))}</ul>
          )}
        </CardContent>
      </Card>
      {open && <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>{editing ? "Edit task" : "Create task"}</CardTitle><Button size="icon" variant="ghost" onClick={() => { setEditing(null); setCreating(false); }} aria-label="Close"><X className="size-4" /></Button></CardHeader>
        <CardContent><form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <div><Label htmlFor="task-title">Title</Label><Input id="task-title" name="title" required maxLength={160} defaultValue={editing?.title ?? ""} /></div>
          <div><Label htmlFor="task-reward">AC reward</Label><Input id="task-reward" name="reward_amount" type="number" min="0" max="1000000" step="1" required defaultValue={editing?.reward_amount ?? 0} /></div>
          <div><Label htmlFor="task-status">Status</Label><Select id="task-status" name="status" defaultValue={editing?.status ?? "draft"}><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></Select></div>
          <div><Label htmlFor="task-start">Start date</Label><Input id="task-start" type="datetime-local" name="starts_at" defaultValue={localDate(editing?.starts_at ?? null)} /></div>
          <div><Label htmlFor="task-deadline">Deadline</Label><Input id="task-deadline" type="datetime-local" name="deadline" defaultValue={localDate(editing?.deadline ?? null)} /></div>
          <div className="md:col-span-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" name="description" maxLength={2000} defaultValue={editing?.description ?? ""} /></div>
          <div className="md:col-span-2"><Label htmlFor="task-instructions">Instructions</Label><Textarea id="task-instructions" name="instructions" maxLength={5000} defaultValue={editing?.instructions ?? ""} /></div>
          <div className="md:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save task"}</Button></div>
        </form></CardContent>
      </Card>}
    </div>
  );
}
