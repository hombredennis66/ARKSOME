"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type NotificationActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Mark a single notification as read (RLS scopes the update to the owner). */
export async function markNotificationRead(id: string): Promise<NotificationActionResult> {
  if (typeof id !== "string" || id.trim().length === 0 || id.length > 64) {
    return { ok: false, error: "Invalid notification." };
  }

  const user = await requireUser("/notifications");
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true, message: "Marked as read." };
}

/** Mark every unread notification for the signed-in member as read. */
export async function markAllRead(): Promise<NotificationActionResult> {
  const user = await requireUser("/notifications");
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true, message: "All notifications marked as read." };
}
