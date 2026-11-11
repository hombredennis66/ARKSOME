"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireModerator } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  Campaign,
  ContentStatus,
  ContentType,
  Database,
  Json,
  QuizQuestion,
  UserRole,
} from "@/lib/database.types";
import { formatCoins, slugify } from "@/lib/utils";

/** Result contract shared by every admin server action. */
export type AdminActionResult = { ok: boolean; error?: string; message?: string };

/** Content form payload shared between the client form and the actions. */
export type ContentInput = {
  title: string;
  slug: string;
  type: ContentType;
  status: ContentStatus;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  tags: string[];
  is_sponsored: boolean;
  sponsor_name: string | null;
};

export type CampaignInput = {
  name: string;
  sponsor: string | null;
  status: Campaign["status"];
  starts_at: string | null;
  ends_at: string | null;
  budget_coins: number | null;
};

export type RewardConfigInput = {
  amount: number;
  daily_limit: number | null;
  per_user_limit: number | null;
  enabled: boolean;
  description: string | null;
};

export type ActivityInput = {
  key: string;
  title: string;
  description: string | null;
  activity_type: string;
  reward_amount: number;
  enabled: boolean;
  position: number;
};

export type QuizInput = {
  slug: string;
  title: string;
  description: string | null;
  reward_amount: number;
  max_attempts_per_day: number;
  is_active: boolean;
  /** Raw JSON textareas — parsed and validated server-side. */
  questionsJson: string;
  answersJson: string;
};

type SessionClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

const ROLES: UserRole[] = ["member", "moderator", "admin", "super_admin"];
const CONTENT_TYPES: ContentType[] = ["article", "video", "short", "community"];
const CONTENT_STATUSES: ContentStatus[] = ["draft", "pending", "published", "rejected", "removed"];
const CAMPAIGN_STATUSES: Campaign["status"][] = ["draft", "active", "paused", "ended"];
const REPORT_STATUSES = ["reviewing", "resolved", "dismissed"] as const;

const SERVICE_KEY_MISSING =
  "SUPABASE_SERVICE_ROLE_KEY is not configured. This change needs privileged database access, so it is unavailable until the service key is added to .env.local.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^[a-z0-9][a-z0-9_-]{1,59}$/;
const MAX_COINS = 1_000_000;

function fail(error: string): AdminActionResult {
  return { ok: false, error };
}

function ok(message: string): AdminActionResult {
  return { ok: true, message };
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function trimOrNull(value: string | null | undefined, max: number): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Audit trail. MUST run through the operator's session client: the function is
 * SECURITY DEFINER and derives the actor from auth.uid() (absent on the
 * service-role client). Failures are logged, never swallowed silently.
 */
async function logAdminAction(
  supabase: SessionClient,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Json,
): Promise<void> {
  const { error } = await supabase.rpc("log_admin_action", {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_metadata: metadata ?? {},
  });
  if (error) console.error("[admin] audit log write failed:", error.message);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Replace a member's single role row (RLS blocks admin writes to user_roles). */
export async function adminSetRole(userId: string, role: UserRole): Promise<AdminActionResult> {
  const user = await requireAdmin();
  if (!isUuid(userId)) return fail("Invalid user id.");
  if (!ROLES.includes(role)) return fail("Invalid role.");
  if (userId === user.id) return fail("You cannot change your own role.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const service = getServiceClient();
  if (!service) return fail(SERVICE_KEY_MISSING);

  const { error: deleteError } = await service.from("user_roles").delete().eq("user_id", userId);
  if (deleteError) return fail(deleteError.message);

  const { error: insertError } = await service
    .from("user_roles")
    .insert({ user_id: userId, role, granted_by: user.id });
  if (insertError) return fail(insertError.message);

  await logAdminAction(supabase, "role_change", "user", userId, { role });
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return ok(`Role updated to ${role.replace("_", " ")}.`);
}

/** Ban/unban an account (RLS blocks admin writes to other users' profiles). */
export async function adminSetBanned(userId: string, banned: boolean): Promise<AdminActionResult> {
  const user = await requireAdmin();
  if (!isUuid(userId)) return fail("Invalid user id.");
  if (userId === user.id) return fail("You cannot ban your own account.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const service = getServiceClient();
  if (!service) return fail(SERVICE_KEY_MISSING);

  const { data, error } = await service
    .from("profiles")
    .update({ is_banned: banned })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("User not found.");

  await logAdminAction(supabase, banned ? "user_ban" : "user_unban", "user", userId, { banned });
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return ok(banned ? "Account banned." : "Account reinstated.");
}

/**
 * Manual AC adjustment. Goes through admin_adjust_balance() so the immutable
 * ledger, wallet lock and non-negative balance check stay in one transaction.
 * (The database function writes its own audit row; we add one with the actor's
 * context via log_admin_action as required for every mutation.)
 */
export async function adminAdjustBalance(
  userId: string,
  amount: number,
  reason: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(userId)) return fail("Invalid user id.");
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_COINS) {
    return fail(`Amount must be a whole, non-zero number of AC within ±${MAX_COINS.toLocaleString()}.`);
  }
  const trimmedReason = (reason ?? "").trim();
  if (trimmedReason.length < 3 || trimmedReason.length > 200) {
    return fail("A reason of 3–200 characters is required for the audit trail.");
  }

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");

  const { data, error } = await supabase.rpc("admin_adjust_balance", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: trimmedReason,
  });
  if (error) return fail(error.message);

  const payload = data as { ok?: boolean; error?: string; balance?: number } | null;
  if (!payload?.ok) return fail(payload?.error ?? "Adjustment failed.");

  await logAdminAction(supabase, "balance_adjust", "user", userId, {
    amount,
    reason: trimmedReason,
    balance: payload.balance ?? 0,
    actor_note: "logged from admin console",
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  const direction = amount > 0 ? "credited" : "debited";
  return ok(
    `Account ${direction} ${formatCoins(Math.abs(amount))}. New balance: ${formatCoins(payload.balance ?? 0)}.`,
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

type NormalizedContent = {
  slug: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  tags: string[];
  is_sponsored: boolean;
  sponsor_name: string | null;
};

function normalizeContent(raw: ContentInput): { ok: true; value: NormalizedContent } | { ok: false; error: string } {
  const title = (raw.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title must be 200 characters or fewer." };

  const slug = slugify(raw.slug ?? "") || slugify(title);
  if (!slug) return { ok: false, error: "A slug is required (letters, numbers and dashes)." };
  if (slug.length > 200) return { ok: false, error: "Slug must be 200 characters or fewer." };

  if (!CONTENT_TYPES.includes(raw.type)) return { ok: false, error: "Invalid content type." };
  if (!CONTENT_STATUSES.includes(raw.status)) return { ok: false, error: "Invalid content status." };

  const excerpt = trimOrNull(raw.excerpt, 500);
  if ((raw.excerpt ?? "").trim().length > 500) return { ok: false, error: "Excerpt must be 500 characters or fewer." };

  const body = trimOrNull(raw.body, 100_000);
  const cover = trimOrNull(raw.cover_url, 1000);
  const video = trimOrNull(raw.video_url, 1000);
  for (const [label, url] of [
    ["Cover URL", cover],
    ["Video URL", video],
  ] as const) {
    if (url && !/^(https?:\/\/|\/)/.test(url)) {
      return { ok: false, error: `${label} must start with http(s):// or /.` };
    }
  }

  let duration: number | null = null;
  if (raw.duration_seconds !== null && raw.duration_seconds !== undefined) {
    if (!Number.isInteger(raw.duration_seconds) || raw.duration_seconds < 0 || raw.duration_seconds > 604_800) {
      return { ok: false, error: "Duration must be a whole number of seconds (0–604800)." };
    }
    duration = raw.duration_seconds;
  }

  const tags = Array.from(
    new Set((raw.tags ?? []).map((tag) => tag.trim().slice(0, 40)).filter(Boolean)),
  );
  if (tags.length > 20) return { ok: false, error: "Use at most 20 tags." };

  const isSponsored = Boolean(raw.is_sponsored);
  const sponsor = trimOrNull(raw.sponsor_name, 120);
  if (isSponsored && !sponsor) {
    return { ok: false, error: "Sponsored content requires a sponsor name (database CHECK constraint)." };
  }

  return {
    ok: true,
    value: {
      slug,
      title,
      type: raw.type,
      status: raw.status,
      excerpt,
      body,
      cover_url: cover,
      video_url: video,
      duration_seconds: duration,
      tags,
      is_sponsored: isSponsored,
      sponsor_name: isSponsored ? sponsor : null,
    },
  };
}

/** Create content. RLS only lets admins *insert* drafts/pending, so a final
 * status (e.g. published) is applied with a follow-up update. */
export async function adminCreateContent(raw: ContentInput): Promise<AdminActionResult> {
  const user = await requireAdmin();
  const normalized = normalizeContent(raw);
  if (!normalized.ok) return fail(normalized.error);
  const value = normalized.value;

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");

  const insertStatus: ContentStatus =
    value.status === "draft" || value.status === "pending" ? value.status : "draft";

  const { data, error } = await supabase
    .from("content")
    .insert({
      ...value,
      status: insertStatus,
      published_at: null,
      author_id: user.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  if (value.status !== insertStatus) {
    const { error: updateError } = await supabase
      .from("content")
      .update({
        status: value.status,
        ...(value.status === "published" ? { published_at: new Date().toISOString() } : {}),
      })
      .eq("id", data.id);
    if (updateError) return fail(updateError.message);
  }

  await logAdminAction(supabase, "content_create", "content", data.id, {
    slug: value.slug,
    title: value.title,
    status: value.status,
    type: value.type,
  });
  revalidatePath("/admin/content");
  revalidatePath("/admin");
  revalidatePath("/");
  return ok("Content created.");
}

export async function adminUpdateContent(id: string, raw: ContentInput): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return fail("Invalid content id.");
  const normalized = normalizeContent(raw);
  if (!normalized.ok) return fail(normalized.error);
  const value = normalized.value;

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");

  const { data: existing, error: readError } = await supabase
    .from("content")
    .select("id, published_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return fail(readError.message);
  if (!existing) return fail("Content not found.");

  const { error } = await supabase
    .from("content")
    .update({
      ...value,
      ...(value.status === "published" && !existing.published_at
        ? { published_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await logAdminAction(supabase, "content_update", "content", id, {
    slug: value.slug,
    status: value.status,
    type: value.type,
  });
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${id}`);
  revalidatePath("/admin");
  revalidatePath("/");
  return ok("Content saved.");
}

// ---------------------------------------------------------------------------
// Ads & campaigns
// ---------------------------------------------------------------------------

/** Enable/disable a placement (no admin UPDATE policy on ad_placements). */
export async function adminTogglePlacement(id: string, enabled: boolean): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return fail("Invalid placement id.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const service = getServiceClient();
  if (!service) return fail(SERVICE_KEY_MISSING);

  const { data, error } = await service
    .from("ad_placements")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, key")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("Placement not found.");

  await logAdminAction(supabase, "placement_toggle", "ad_placement", id, {
    key: data.key,
    enabled,
  });
  revalidatePath("/admin/ads");
  return ok(enabled ? `“${data.key}” enabled.` : `“${data.key}” disabled.`);
}

export async function adminSaveCampaign(
  id: string | null,
  raw: CampaignInput,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (id !== null && !isUuid(id)) return fail("Invalid campaign id.");

  const name = (raw.name ?? "").trim();
  if (!name || name.length > 160) return fail("Campaign name is required (max 160 characters).");
  if (!CAMPAIGN_STATUSES.includes(raw.status)) return fail("Invalid campaign status.");

  const sponsor = trimOrNull(raw.sponsor, 160);
  const budget =
    raw.budget_coins === null || raw.budget_coins === undefined
      ? null
      : raw.budget_coins;
  if (budget !== null && (!Number.isInteger(budget) || budget < 0 || budget > MAX_COINS)) {
    return fail(`Budget must be a whole number of AC between 0 and ${MAX_COINS.toLocaleString()}.`);
  }

  const startsAt = normalizeDate(raw.starts_at);
  const endsAt = normalizeDate(raw.ends_at);
  if (startsAt === "invalid" || endsAt === "invalid") return fail("Dates must be valid dates.");
  if (startsAt && endsAt && startsAt > endsAt) return fail("End date must be on or after the start date.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const service = getServiceClient();
  if (!service) return fail(SERVICE_KEY_MISSING);

  const row = {
    name,
    sponsor,
    status: raw.status,
    starts_at: startsAt,
    ends_at: endsAt,
    budget_coins: budget,
  };

  if (id) {
    const { data, error } = await service.from("campaigns").update(row).eq("id", id).select("id").maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Campaign not found.");
    await logAdminAction(supabase, "campaign_update", "campaign", id, { name, status: row.status });
    revalidatePath("/admin/ads");
    return ok("Campaign updated.");
  }

  const { data, error } = await service.from("campaigns").insert({ ...row, impressions: 0, clicks: 0 }).select("id").single();
  if (error) return fail(error.message);
  await logAdminAction(supabase, "campaign_create", "campaign", data.id, { name, status: row.status });
  revalidatePath("/admin/ads");
  return ok("Campaign created.");
}

/** "" -> null, "2026-01-01" -> ISO string, anything else -> "invalid". */
function normalizeDate(value: string | null | undefined): string | null | "invalid" {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Reward configs
// ---------------------------------------------------------------------------

export async function adminUpdateRewardConfig(
  id: string,
  raw: RewardConfigInput,
): Promise<AdminActionResult> {
  const user = await requireAdmin();
  if (!isUuid(id)) return fail("Invalid reward config id.");
  if (!Number.isInteger(raw.amount) || raw.amount < 0 || raw.amount > MAX_COINS) {
    return fail(`Amount must be a whole number of AC between 0 and ${MAX_COINS.toLocaleString()}.`);
  }
  for (const [label, value] of [
    ["Daily limit", raw.daily_limit],
    ["Per-user limit", raw.per_user_limit],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > MAX_COINS)) {
      return fail(`${label} must be empty or a whole number between 0 and ${MAX_COINS.toLocaleString()}.`);
    }
  }

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const service = getServiceClient();
  if (!service) return fail(SERVICE_KEY_MISSING);

  const { data: config, error: readError } = await supabase
    .from("reward_configs")
    .select("id, key")
    .eq("id", id)
    .maybeSingle();
  if (readError) return fail(readError.message);
  if (!config) return fail("Reward config not found.");

  const description = trimOrNull(raw.description, 500);

  const { data, error } = await service
    .from("reward_configs")
    .update({
      amount: raw.amount,
      daily_limit: raw.daily_limit,
      per_user_limit: raw.per_user_limit,
      enabled: Boolean(raw.enabled),
      description,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("Reward config not found.");

  await logAdminAction(supabase, "reward_config_update", "reward_config", id, {
    key: config.key,
    amount: raw.amount,
    daily_limit: raw.daily_limit,
    per_user_limit: raw.per_user_limit,
    enabled: Boolean(raw.enabled),
  });
  revalidatePath("/admin/rewards");
  revalidatePath("/activities");
  return ok("Reward configuration saved. Caps remain enforced by the database.");
}

// ---------------------------------------------------------------------------
// Activities & quizzes
// ---------------------------------------------------------------------------

export async function adminSaveActivity(
  id: string | null,
  raw: ActivityInput,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (id !== null && !isUuid(id)) return fail("Invalid activity id.");

  const key = (raw.key ?? "").trim();
  if (!KEY_RE.test(key)) return fail("Key must be 2–60 lowercase characters: letters, numbers, _ or -.");
  const title = (raw.title ?? "").trim();
  if (!title || title.length > 160) return fail("Title is required (max 160 characters).");
  const activityType = (raw.activity_type ?? "").trim();
  if (!activityType || activityType.length > 60) return fail("Activity type is required (max 60 characters).");
  if (!Number.isInteger(raw.reward_amount) || raw.reward_amount < 0 || raw.reward_amount > MAX_COINS) {
    return fail(`Reward must be a whole number of AC between 0 and ${MAX_COINS.toLocaleString()}.`);
  }
  if (!Number.isInteger(raw.position) || raw.position < -1000 || raw.position > 1000) {
    return fail("Position must be a whole number between -1000 and 1000.");
  }

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const service = getServiceClient();
  if (!service) return fail(SERVICE_KEY_MISSING);

  const row = {
    key,
    title,
    description: trimOrNull(raw.description, 500),
    activity_type: activityType,
    reward_amount: raw.reward_amount,
    enabled: Boolean(raw.enabled),
    position: raw.position,
  };

  if (id) {
    const { data, error } = await service.from("activities").update(row).eq("id", id).select("id").maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Activity not found.");
    await logAdminAction(supabase, "activity_update", "activity", id, { key, reward_amount: row.reward_amount });
    revalidatePath("/admin/activities");
    revalidatePath("/activities");
    return ok("Activity saved.");
  }

  const { data, error } = await service.from("activities").insert({ ...row, config: {} }).select("id").single();
  if (error) return fail(error.message);
  await logAdminAction(supabase, "activity_create", "activity", data.id, { key });
  revalidatePath("/admin/activities");
  revalidatePath("/activities");
  return ok("Activity created.");
}

export async function adminSetActivityEnabled(
  id: string,
  enabled: boolean,
): Promise<AdminActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return fail("Invalid activity id.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const service = getServiceClient();
  if (!service) return fail(SERVICE_KEY_MISSING);

  const { data, error } = await service
    .from("activities")
    .update({ enabled })
    .eq("id", id)
    .select("id, key")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("Activity not found.");

  await logAdminAction(supabase, "activity_toggle", "activity", id, { key: data.key, enabled });
  revalidatePath("/admin/activities");
  revalidatePath("/activities");
  return ok(enabled ? "Activity enabled." : "Activity disabled.");
}

type QuizWriteRow = {
  slug: string;
  title: string;
  description: string | null;
  reward_amount: number;
  max_attempts_per_day: number;
  is_active: boolean;
  questions: QuizQuestion[];
  answers: number[];
};

type ParsedQuiz = { ok: true; value: { questions: QuizQuestion[]; answers: number[] } } | { ok: false; error: string };

/** Questions/answers arrive as raw JSON — validated here, never trusted. */
function parseQuizJson(questionsJson: string, answersJson: string): ParsedQuiz {
  let questionsRaw: unknown;
  let answersRaw: unknown;
  try {
    questionsRaw = JSON.parse(questionsJson || "[]");
  } catch {
    return { ok: false, error: "Questions must be valid JSON." };
  }
  try {
    answersRaw = JSON.parse(answersJson || "[]");
  } catch {
    return { ok: false, error: "Answers must be valid JSON." };
  }

  if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) {
    return { ok: false, error: "Questions must be a non-empty JSON array." };
  }
  if (questionsRaw.length > 50) return { ok: false, error: "A quiz can have at most 50 questions." };
  if (!Array.isArray(answersRaw) || answersRaw.length !== questionsRaw.length) {
    return { ok: false, error: "Answers must be an array with one option index per question." };
  }

  const questions: QuizQuestion[] = [];
  for (let i = 0; i < questionsRaw.length; i += 1) {
    const item = questionsRaw[i] as { id?: unknown; question?: unknown; options?: unknown } | null;
    if (!item || typeof item !== "object") return { ok: false, error: `Question ${i + 1} must be an object.` };
    const question = typeof item.question === "string" ? item.question.trim() : "";
    if (!question) return { ok: false, error: `Question ${i + 1} needs a question text.` };
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 8) {
      return { ok: false, error: `Question ${i + 1} needs 2–8 options.` };
    }
    const options = item.options.map((option) => String(option ?? "").trim());
    if (options.some((option) => !option)) return { ok: false, error: `Question ${i + 1} has an empty option.` };
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `q${i + 1}`;
    questions.push({ id, question, options });
  }

  const answers: number[] = [];
  for (let i = 0; i < answersRaw.length; i += 1) {
    const answer = answersRaw[i];
    const max = questions[i].options.length - 1;
    if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer > max) {
      return { ok: false, error: `Answer ${i + 1} must be the option index (0–${max}).` };
    }
    answers.push(answer);
  }

  return { ok: true, value: { questions, answers } };
}

/** Shared scalar validation for create and update. */
function normalizeQuizFields(raw: QuizInput): Omit<QuizWriteRow, "questions" | "answers"> {
  return {
    slug: slugify(raw.slug || "") || slugify(raw.title || ""),
    title: (raw.title ?? "").trim(),
    description: trimOrNull(raw.description, 1000),
    reward_amount: raw.reward_amount,
    max_attempts_per_day: raw.max_attempts_per_day,
    is_active: Boolean(raw.is_active),
  };
}

export async function adminSaveQuiz(id: string | null, raw: QuizInput): Promise<AdminActionResult> {
  await requireAdmin();
  if (id !== null && !isUuid(id)) return fail("Invalid quiz id.");

  const parsed = parseQuizJson(raw.questionsJson, raw.answersJson);
  if (!parsed.ok) return fail(parsed.error);

  const fields = normalizeQuizFields(raw);
  if (!fields.slug) return fail("A slug is required (letters, numbers and dashes).");
  if (!fields.title || fields.title.length > 200) return fail("Title is required (max 200 characters).");
  if (!Number.isInteger(fields.reward_amount) || fields.reward_amount < 0 || fields.reward_amount > MAX_COINS) {
    return fail(`Reward must be a whole number of AC between 0 and ${MAX_COINS.toLocaleString()}.`);
  }
  if (!Number.isInteger(fields.max_attempts_per_day) || fields.max_attempts_per_day < 1 || fields.max_attempts_per_day > 100) {
    return fail("Max attempts per day must be between 1 and 100.");
  }

  const value: QuizWriteRow = { ...fields, questions: parsed.value.questions, answers: parsed.value.answers };

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");
  const service = getServiceClient();
  if (!service) return fail(SERVICE_KEY_MISSING);

  if (id) {
    // `answers` is a real column but is absent from the handwritten Quiz type
    // (deliberately hidden from clients), so the payload is asserted here —
    // only the service-role client may ever write it.
    const { data, error } = await service
      .from("quizzes")
      .update(value as Database["public"]["Tables"]["quizzes"]["Update"])
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Quiz not found.");
    await logAdminAction(supabase, "quiz_update", "quiz", id, {
      slug: value.slug,
      question_count: value.questions.length,
    });
    revalidatePath("/admin/activities");
    revalidatePath("/activities");
    return ok("Quiz saved.");
  }

  const { data, error } = await service
    .from("quizzes")
    .insert(value as Database["public"]["Tables"]["quizzes"]["Insert"])
    .select("id")
    .single();
  if (error) return fail(error.message);
  await logAdminAction(supabase, "quiz_create", "quiz", data.id, {
    slug: value.slug,
    question_count: value.questions.length,
  });
  revalidatePath("/admin/activities");
  revalidatePath("/activities");
  return ok("Quiz created.");
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function adminSetReportStatus(
  reportId: string,
  status: (typeof REPORT_STATUSES)[number],
): Promise<AdminActionResult> {
  const user = await requireModerator();
  if (!isUuid(reportId)) return fail("Invalid report id.");
  if (!REPORT_STATUSES.includes(status)) return fail("Invalid report status.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");

  const resolving = status !== "reviewing";
  const { data, error } = await supabase
    .from("content_reports")
    .update({
      status,
      resolved_by: resolving ? user.id : null,
      resolved_at: resolving ? new Date().toISOString() : null,
    })
    .eq("id", reportId)
    .select("id, content_id")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("Report not found.");

  const actionName =
    status === "reviewing" ? "report_marked_reviewing" : status === "resolved" ? "report_resolved" : "report_dismissed";
  await logAdminAction(supabase, actionName, "report", reportId, { content_id: data.content_id });
  revalidatePath("/admin/reports");
  return ok(
    status === "reviewing" ? "Report marked as reviewing." : status === "resolved" ? "Report resolved." : "Report dismissed.",
  );
}

/** Take content down and resolve any open/reviewing reports against it. */
export async function adminRemoveContent(contentId: string): Promise<AdminActionResult> {
  const user = await requireAdmin();
  if (!isUuid(contentId)) return fail("Invalid content id.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");

  const { data: content, error: readError } = await supabase
    .from("content")
    .select("id, title, status")
    .eq("id", contentId)
    .maybeSingle();
  if (readError) return fail(readError.message);
  if (!content) return fail("Content not found.");

  const { error } = await supabase.from("content").update({ status: "removed" }).eq("id", contentId);
  if (error) return fail(error.message);

  const { data: resolvedReports, error: reportError } = await supabase
    .from("content_reports")
    .update({ status: "resolved", resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("content_id", contentId)
    .in("status", ["open", "reviewing"])
    .select("id");
  if (reportError) console.error("[admin] failed to resolve reports:", reportError.message);

  await logAdminAction(supabase, "content_removed", "content", contentId, {
    title: content.title,
    previous_status: content.status,
    auto_resolved_reports: resolvedReports?.length ?? 0,
  });
  revalidatePath("/admin/reports");
  revalidatePath("/admin/content");
  revalidatePath("/admin");
  revalidatePath("/");
  return ok(
    `Content removed.${resolvedReports?.length ? ` ${resolvedReports.length} open report(s) resolved.` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Settings (audit-path proof)
// ---------------------------------------------------------------------------

export async function adminLogSettingsUpdate(key: string, value: string): Promise<AdminActionResult> {
  await requireAdmin();
  const cleanKey = (key ?? "").trim();
  const cleanValue = (value ?? "").trim();
  if (!cleanKey || !KEY_RE.test(cleanKey)) {
    return fail("Setting key must be 2–60 lowercase characters: letters, numbers, _ or -.");
  }
  if (cleanValue.length > 500) return fail("Value must be 500 characters or fewer.");

  const supabase = await createClient();
  if (!supabase) return fail("Supabase is not configured.");

  await logAdminAction(supabase, "settings_update", "setting", cleanKey, {
    key: cleanKey,
    value: cleanValue,
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/audit-logs");
  return ok(`Audit entry written for “${cleanKey}”. See /admin/audit-logs.`);
}
