"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";

export type SettingsState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const URL_RE = /^https?:\/\/\S+$/;

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

/** Checkboxes submit "on" when checked and are absent when unchecked. */
function flag(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function unconfigured(): SettingsState {
  return { ok: false, error: "Supabase is not configured yet. Add your project keys to .env.local." };
}

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return unconfigured();

  const displayName = text(formData.get("display_name"));
  const username = text(formData.get("username"));
  const bio = text(formData.get("bio"));
  const avatarUrl = text(formData.get("avatar_url"));

  if (username.length < 3 || username.length > 24) {
    return { ok: false, error: "Username must be 3–24 characters." };
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "Username may only contain letters, numbers and underscores." };
  }
  if (displayName.length > 60) {
    return { ok: false, error: "Display name must be 60 characters or fewer." };
  }
  if (bio.length > 280) {
    return { ok: false, error: "Bio must be 280 characters or fewer." };
  }
  if (avatarUrl && !URL_RE.test(avatarUrl)) {
    return { ok: false, error: "Avatar URL must start with http:// or https://." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      username,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That username is already taken."
          : "We couldn't save your profile. Please try again.",
    };
  }

  revalidatePath("/settings");
  return { ok: true, message: "Profile updated." };
}

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return unconfigured();

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      email_notifications: flag(formData.get("email_notifications")),
      marketing_consent: flag(formData.get("marketing_consent")),
      rewarded_ads_enabled: flag(formData.get("rewarded_ads_enabled")),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { ok: false, error: "We couldn't save your preferences. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true, message: "Preferences saved." };
}

export async function recordConsent(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const supabase = await createClient();
  if (!supabase) return unconfigured();

  const { error } = await supabase.from("consents").insert([
    {
      user_id: user.id,
      consent_type: "cookie",
      granted: flag(formData.get("cookie_consent")),
      source: "settings",
    },
    {
      user_id: user.id,
      consent_type: "advertising",
      granted: flag(formData.get("advertising_consent")),
      source: "settings",
    },
  ]);

  if (error) {
    return { ok: false, error: "We couldn't save your consent choices. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true, message: "Consent choices saved." };
}

export async function changePassword(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireUser();
  const supabase = await createClient();
  if (!supabase) return unconfigured();

  const password = text(formData.get("password"));
  const confirmation = text(formData.get("confirm_password"));

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirmation) {
    return { ok: false, error: "Both passwords must match." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, message: "Password updated. Use your new password next time you sign in." };
}

/**
 * Permanently delete the authenticated account. The confirmation phrase is
 * checked on the server, and the Supabase Auth admin API performs the delete
 * so the user's cascading profile, wallet and activity records are removed.
 */
export async function deleteAccount(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const confirmation = text(formData.get("confirmation"));
  if (confirmation !== "DELETE MY ACCOUNT") {
    return { ok: false, error: "Type DELETE MY ACCOUNT exactly to confirm permanent deletion." };
  }

  const service = getServiceClient();
  if (!service) {
    return {
      ok: false,
      error: "Account deletion is temporarily unavailable because the server service key is not configured. Contact privacy@arksome.example.",
    };
  }

  // Keep a minimal operational record before the auth row disappears. The
  // audit_logs.actor_id foreign key is ON DELETE SET NULL.
  await service.from("audit_logs").insert({
    actor_id: user.id,
    action: "account_deleted",
    target_type: "user",
    target_id: user.id,
    metadata: { source: "account_settings" },
  });

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "We couldn't delete your account. Please contact privacy@arksome.example." };

  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/?deleted=1");
}
