"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS } from "@/lib/constants";
import { assertRateLimit } from "@/lib/rate-limit";

export type ReportResult = { ok: boolean; message?: string; error?: string };

export async function submitContentReport(
  contentId: string,
  reason: string,
  details: string,
): Promise<ReportResult> {
  const user = await requireUser();
  const limit = assertRateLimit("report", user.id, RATE_LIMITS.report);
  if (!limit.ok) return { ok: false, error: "Too many reports. Please try again later." };

  if (!/^[0-9a-f-]{36}$/i.test(contentId)) return { ok: false, error: "Invalid content." };
  const cleanReason = reason.trim().slice(0, 80);
  const cleanDetails = details.trim().slice(0, 1000);
  if (!cleanReason) return { ok: false, error: "Choose a reason for reporting this post." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured yet." };

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    content_id: contentId,
    reason: cleanReason,
    details: cleanDetails || null,
  });

  if (error?.code === "23505") {
    return { ok: true, message: "You already reported this post. Our moderation team has it in the queue." };
  }
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/reports");
  return { ok: true, message: "Thanks — your report was sent to moderation." };
}
