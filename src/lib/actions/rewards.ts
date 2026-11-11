"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/constants";
import { assertRateLimit } from "@/lib/rate-limit";

export type RewardResult = {
  ok: boolean;
  amount?: number;
  balance?: number;
  duplicate?: boolean;
  error?: string;
  message?: string;
  meta?: Record<string, unknown>;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function denied(message: string): RewardResult {
  return { ok: false, error: message };
}

/**
 * Daily check-in. Server-side only: the client never sets a balance.
 * Duplicate claims are rejected by the unique idempotency key in the DB.
 */
export async function claimDailyCheckin(): Promise<RewardResult> {
  const user = await requireUser("/activities");

  const limit = assertRateLimit("reward:checkin", user.id, RATE_LIMITS.rewardClaim);
  if (!limit.ok) return denied(`Too many attempts. Retry in ${limit.retryAfterSeconds}s.`);

  const supabase = await createClient();
  if (!supabase) return denied("Supabase is not configured.");

  const date = todayKey();

  // Streak is derived from previous check-ins, never from the client.
  const { data: yesterday } = await supabase
    .from("daily_checkins")
    .select("checkin_date, streak_count")
    .eq("user_id", user.id)
    .eq("checkin_date", new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
    .maybeSingle();

  const streak = (yesterday?.streak_count ?? 0) + 1;

  const { data, error } = await supabase.rpc("claim_reward", {
    p_event_type: "daily_checkin",
    p_business_key: date,
    p_source: "checkin",
    p_metadata: { date, streak },
  });

  if (error) return denied(error.message);

  const result = data as RewardResult;

  // Record the check-in (unique per user+day blocks duplicates at the DB level).
  const { error: checkinError } = await supabase
    .from("daily_checkins")
    .upsert(
      { user_id: user.id, checkin_date: date, streak_count: streak, coins_awarded: result.amount ?? 0 },
      { onConflict: "user_id,checkin_date", ignoreDuplicates: true },
    );

  if (checkinError && !checkinError.message.includes("duplicate")) {
    console.error("[checkin] failed to record:", checkinError.message);
  }

  let streakBonus = 0;
  if (streak > 0 && streak % 7 === 0 && result.ok) {
    const bonus = await supabase.rpc("claim_reward", {
      p_event_type: "streak_bonus",
      p_business_key: `streak:${streak}`,
      p_source: "streak",
      p_metadata: { streak },
    });
    if (!bonus.error && bonus.data) {
      const bonusResult = bonus.data as RewardResult;
      streakBonus = bonusResult.amount ?? 0;
    }
  }

  revalidatePath("/activities");
  revalidatePath("/dashboard");
  revalidatePath("/wallet");

  if (!result.ok && !result.duplicate) return denied(result.error ?? "Claim failed.");

  return {
    ok: true,
    amount: (result.amount ?? 0) + streakBonus,
    balance: result.balance,
    duplicate: Boolean(result.duplicate),
    message: result.duplicate
      ? "You have already checked in today."
      : `Checked in! ${result.amount ?? 0} AC added${streakBonus ? ` + ${streakBonus} AC streak bonus` : ""}.`,
    meta: { streak, streakBonus },
  };
}

/**
 * Submit quiz answers. Grading happens in the database — the client never
 * receives the answer key.
 */
export async function submitQuiz(quizSlug: string, answers: number[]): Promise<RewardResult> {
  const user = await requireUser("/activities");

  const limit = assertRateLimit("reward:quiz", user.id, RATE_LIMITS.rewardClaim);
  if (!limit.ok) return denied(`Too many attempts. Retry in ${limit.retryAfterSeconds}s.`);

  const supabase = await createClient();
  if (!supabase) return denied("Supabase is not configured.");
  if (!Array.isArray(answers) || answers.some((a) => typeof a !== "number")) {
    return denied("Invalid submission.");
  }

  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    p_quiz_slug: quizSlug,
    p_answers: answers,
    p_source: "quiz",
  });

  if (error) return denied(error.message);

  const payload = data as {
    ok: boolean;
    error?: string;
    correct?: number;
    total?: number;
    award?: RewardResult;
  };

  if (!payload.ok) return denied(payload.error ?? "Quiz submission failed.");

  revalidatePath("/activities");
  revalidatePath("/dashboard");
  revalidatePath("/wallet");

  return {
    ok: true,
    amount: payload.award?.amount ?? 0,
    balance: payload.award?.balance,
    duplicate: false,
    message: `You scored ${payload.correct}/${payload.total}.`,
    meta: { correct: payload.correct, total: payload.total },
  };
}

/** Award the small content-discovery bonus for opening a published item. */
export async function claimContentRead(contentId: string): Promise<RewardResult> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return denied("Supabase is not configured.");

  const limit = assertRateLimit("reward:read", user.id, RATE_LIMITS.rewardClaim);
  if (!limit.ok) return denied("Rate limited.");

  const { data, error } = await supabase.rpc("claim_reward", {
    p_event_type: "content_read",
    p_business_key: `${contentId}:${todayKey()}`,
    p_source: "feed",
    p_metadata: { content_id: contentId },
  });

  if (error) return denied(error.message);

  const result = data as RewardResult;
  if (result.ok && !result.duplicate) {
    revalidatePath("/dashboard");
    revalidatePath("/wallet");
  }
  return result;
}
