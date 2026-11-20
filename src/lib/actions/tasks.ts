"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/database.types";

export type TaskActionResult = { ok: boolean; error?: string; message?: string };
export type TaskInput = Pick<Task, "title" | "description" | "instructions" | "reward_amount" | "status" | "starts_at" | "deadline">;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASK_STATUSES = ["draft", "active", "inactive"] as const;

function dateValue(value: string | null): string | null | "invalid" {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
}

function fail(error: string): TaskActionResult {
  return { ok: false, error };
}

export async function adminSaveTask(id: string | null, raw: TaskInput): Promise<TaskActionResult> {
  const admin = await requireAdmin();
  if (id !== null && !UUID_RE.test(id)) return fail("Invalid task id.");
  const title = (raw.title ?? "").trim();
  const description = (raw.description ?? "").trim();
  const instructions = (raw.instructions ?? "").trim();
  if (!title || title.length > 160) return fail("Task title is required and must be 160 characters or fewer.");
  if (description.length > 2000 || instructions.length > 5000) return fail("Task text is too long.");
  if (!Number.isSafeInteger(raw.reward_amount) || raw.reward_amount < 0 || raw.reward_amount > 1_000_000) {
    return fail("Reward must be a whole number between 0 and 1,000,000 AC.");
  }
  if (!TASK_STATUSES.includes(raw.status as (typeof TASK_STATUSES)[number])) return fail("Invalid task status.");
  const startsAt = dateValue(raw.starts_at);
  const deadline = dateValue(raw.deadline);
  if (startsAt === "invalid" || deadline === "invalid") return fail("Enter valid availability dates.");
  if (startsAt && deadline && startsAt > deadline) return fail("The deadline must be after the start date.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const values = { title, description, instructions, reward_amount: raw.reward_amount, status: raw.status, starts_at: startsAt, deadline, updated_at: new Date().toISOString() };

  if (id) {
    const { data, error } = await supabase.from("tasks").update(values).eq("id", id).select("id").maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Task not found.");
    await supabase.rpc("log_admin_action", { p_action: "task_update", p_target_type: "task", p_target_id: id, p_metadata: { title, status: raw.status } });
  } else {
    const { data, error } = await supabase.from("tasks").insert({ ...values, created_by: admin.id }).select("id").single();
    if (error) return fail(error.message);
    await supabase.rpc("log_admin_action", { p_action: "task_create", p_target_type: "task", p_target_id: data.id, p_metadata: { title, status: raw.status } });
  }
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/tasks/monitor");
  revalidatePath("/tasks");
  return { ok: true, message: id ? "Task updated." : "Task created." };
}

export async function memberSubmitTask(taskId: string): Promise<TaskActionResult> {
  await requireUser("/tasks");
  if (!UUID_RE.test(taskId)) return fail("Invalid task.");
  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const { error } = await supabase.rpc("submit_task_completion", { p_task_id: taskId });
  if (error) {
    const messages: Record<string, string> = {
      already_submitted: "You have already submitted this task.",
      task_unavailable: "This task is not available for completion.",
      task_not_started: "This task is not open yet.",
      task_deadline_passed: "The deadline for this task has passed.",
      account_unavailable: "Your account cannot submit tasks right now.",
    };
    const key = Object.keys(messages).find((candidate) => error.message.includes(candidate));
    return fail(key ? messages[key] : "The task could not be submitted. Please try again.");
  }
  revalidatePath("/tasks");
  revalidatePath("/admin/tasks/monitor");
  return { ok: true, message: "Completion submitted. It is now awaiting admin review." };
}

export async function adminReviewTaskSubmission(
  submissionId: string,
  decision: "approved" | "rejected",
  note: string,
): Promise<TaskActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(submissionId)) return fail("Invalid completion id.");
  if (decision !== "approved" && decision !== "rejected") return fail("Invalid review decision.");
  const trimmedNote = note.trim();
  if (trimmedNote.length > 1000) return fail("Review note must be 1,000 characters or fewer.");
  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const { error } = await supabase.rpc("review_task_completion", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_review_note: trimmedNote || null,
  });
  if (error) {
    const map: [string, string][] = [
      ["submission_already_reviewed", "This completion has already been reviewed."],
      ["submission_not_found", "Completion not found."],
      ["task_reward_failed", "AC reward processing failed. No approval was saved; please try again or check the reward configuration."],
      ["admin_required", "You do not have permission to review completions."],
    ];
    return fail(map.find(([key]) => error.message.includes(key))?.[1] ?? "The review could not be saved.");
  }
  revalidatePath("/admin/tasks/monitor");
  revalidatePath("/tasks");
  revalidatePath("/wallet");
  return { ok: true, message: decision === "approved" ? "Completion approved and reward processed." : "Completion rejected." };
}
