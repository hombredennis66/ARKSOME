"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { formatCoins } from "@/lib/utils";
import { RATE_LIMITS } from "@/lib/constants";
import { assertRateLimit } from "@/lib/rate-limit";

export type UsdActionResult = { ok: boolean; error?: string; message?: string; balance?: number };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCents(value: string): number | null {
  const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 1_000_000_00 ? cents : null;
}

export async function adminAdjustUsdBalance(userId: string, dollars: string, direction: "credit" | "debit", reason: string, requestId: string): Promise<UsdActionResult> {
  await requireAdmin();
  if (typeof userId !== "string" || typeof requestId !== "string" || !UUID_RE.test(userId) || !UUID_RE.test(requestId)) return { ok: false, error: "Invalid user or request." };
  if (direction !== "credit" && direction !== "debit") return { ok: false, error: "Invalid adjustment direction." };
  if (typeof dollars !== "string" || typeof reason !== "string") return { ok: false, error: "Amount and reason are required." };
  const cents = parseCents(dollars);
  if (cents === null) return { ok: false, error: "Enter an amount from $0.01 to $1,000,000.00 with up to two decimal places." };
  const cleanReason = reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) return { ok: false, error: "Reason must be 3–500 characters." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await supabase.rpc("admin_adjust_usd_balance", {
    p_user_id: userId, p_amount_cents: direction === "credit" ? cents : -cents,
    p_reason: cleanReason, p_request_id: requestId,
  });
  if (error) return { ok: false, error: error.message.includes("insufficient_balance") ? "The debit exceeds the member’s available USD balance." : "The USD adjustment could not be applied." };
  const result = data as { balance?: number };
  revalidatePath("/admin/users"); revalidatePath("/wallet"); revalidatePath("/dashboard");
  return { ok: true, balance: result.balance, message: `Simulated USD ${direction} applied. New balance: ${formatCoins(result.balance ?? 0)} TEST.` };
}

export async function memberSubmitUsdActivity(configId: string, details: string, reference: string): Promise<UsdActionResult> {
  const user = await requireUser("/usd-activities");
  if (typeof configId !== "string" || !UUID_RE.test(configId)) return { ok: false, error: "Invalid activity." };
  if (typeof details !== "string" || typeof reference !== "string") return { ok: false, error: "Please provide valid completion details." };
  const limit = assertRateLimit("usd:activity-submission", user.id, RATE_LIMITS.rewardClaim);
  if (!limit.ok) return { ok: false, error: `Too many submissions. Retry in ${limit.retryAfterSeconds}s.` };
  const cleanDetails = details.trim();
  if (cleanDetails.length < 1 || cleanDetails.length > 3000 || reference.trim().length < 1 || reference.trim().length > 300) return { ok: false, error: "Provide completion details and a unique activity reference." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { error } = await supabase.rpc("submit_usd_activity", { p_config_id: configId, p_details: cleanDetails, p_activity_reference: reference.trim() });
  if (error) return { ok: false, error: error.code === "23505" ? "That activity reference has already been submitted." : "Submission could not be saved. Check that the activity is still available." };
  revalidatePath("/usd-activities"); revalidatePath("/wallet");
  return { ok: true, message: "Submitted for administrator review. No balance was credited yet." };
}

export async function adminReviewUsdActivity(id: string, decision: "approved" | "rejected", note: string): Promise<UsdActionResult> {
  await requireAdmin();
  if (typeof id !== "string" || !UUID_RE.test(id) || !["approved", "rejected"].includes(decision) || typeof note !== "string" || note.trim().length > 1000) return { ok: false, error: "Invalid review." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await supabase.rpc("review_usd_activity", { p_submission_id: id, p_decision: decision, p_review_note: note.trim() || null });
  if (error) {
    const message = error.message.includes("already_reviewed")
      ? "This submission has already been reviewed."
      : error.message.includes("self_review")
        ? "You cannot review your own submission."
        : error.message.includes("account_deleted")
          ? "This account was deleted. Its submission remains in history and cannot be approved."
          : "Review could not be saved; no USD was credited.";
    return { ok: false, error: message };
  }
  const result = data as { balance?: number };
  revalidatePath("/admin/usd-rewards"); revalidatePath("/wallet"); revalidatePath("/dashboard");
  return { ok: true, balance: result.balance, message: decision === "approved" ? "Approved and simulated USD credited." : "Submission rejected; no balance change was made." };
}

export async function adminSaveUsdRewardConfig(input: { id?: string; key: string; category: string; label: string; dollars: string; enabled: boolean; dailyLimit: string; perUserLimit: string }): Promise<UsdActionResult> {
  const admin = await requireAdmin();
  if (!input || typeof input !== "object" || typeof input.key !== "string" || typeof input.category !== "string" || typeof input.label !== "string" || typeof input.dollars !== "string" || typeof input.enabled !== "boolean" || typeof input.dailyLimit !== "string" || typeof input.perUserLimit !== "string") return { ok: false, error: "Invalid USD activity configuration." };
  const key = input.key.trim(); const label = input.label.trim(); const amount = parseCents(input.dollars);
  const categories = ["advertisements", "content_engagement", "challenges", "other"];
  const limit = (value: string) => value.trim() === "" ? null : (/^\d{1,8}$/.test(value.trim()) ? Number(value) : NaN);
  const daily = limit(input.dailyLimit); const perUser = limit(input.perUserLimit);
  if ((input.id !== undefined && (typeof input.id !== "string" || !UUID_RE.test(input.id))) || !/^[a-z0-9][a-z0-9_-]{1,59}$/.test(key) || label.length < 1 || label.length > 160 || amount === null || !categories.includes(input.category) || Number.isNaN(daily) || Number.isNaN(perUser)) return { ok: false, error: "Check the activity key, category, label, amount, and limits." };
  const service = getServiceClient();
  if (!service) return { ok: false, error: "Privileged database access is not configured." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const row = { key, category: input.category, label, amount_cents: amount, enabled: input.enabled, daily_limit: daily, per_user_limit: perUser, updated_by: admin.id, updated_at: new Date().toISOString() };
  const result = input.id ? await service.from("usd_reward_configs").update(row).eq("id", input.id).select("id").maybeSingle() : await service.from("usd_reward_configs").insert({ ...row, created_by: admin.id }).select("id").single();
  if (result.error) return { ok: false, error: "Activity configuration could not be saved. Keys must be unique." };
  if (input.id && !result.data) {
    return { ok: false, error: "The USD activity configuration was not found." };
  }
  const audit = await supabase.rpc("log_admin_action", { p_action: input.id ? "usd_reward_config_update" : "usd_reward_config_create", p_target_type: "usd_reward_config", p_target_id: result.data?.id ?? input.id ?? key, p_metadata: { key, category: input.category, label, amount_cents: amount, enabled: input.enabled } });
  if (audit.error) {
    console.error("[admin] USD config audit log failed:", audit.error.message);
    revalidatePath("/admin/usd-rewards");
    revalidatePath("/usd-activities");
    return {
      ok: false,
      error: "Configuration was saved, but its audit log could not be recorded. Contact an administrator.",
    };
  }

  revalidatePath("/admin/usd-rewards");
  revalidatePath("/usd-activities");

  return { ok: true, message: "Simulated USD activity configuration saved." };
}
