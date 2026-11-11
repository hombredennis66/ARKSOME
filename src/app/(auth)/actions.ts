"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RATE_LIMITS } from "@/lib/constants";
import { assertRateLimit } from "@/lib/rate-limit";

export type AuthFormState = {
  error?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only allow same-site relative redirects to prevent open redirects. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return "/dashboard";
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function guardAuthRateLimit(ip: string, action: string) {
  const result = assertRateLimit(`auth:${action}`, ip, RATE_LIMITS.authAction);
  if (!result.ok) {
    return `Too many attempts. Please wait ${result.retryAfterSeconds} seconds and try again.`;
  }
  return null;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();
  const blocked = await guardAuthRateLimit(ip, "signin");
  if (blocked) return { error: blocked };

  if (!isSupabaseConfigured) {
    return { error: "Supabase is not configured yet. Add your project keys to .env.local." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!password) return { error: "Enter your password." };

  const supabase = await createClient();
  if (!supabase) return { error: "Authentication is unavailable right now." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message.includes("Invalid login") ? "Incorrect email or password." : error.message };
  }

  redirect(next);
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();
  const blocked = await guardAuthRateLimit(ip, "signup");
  if (blocked) return { error: blocked };

  if (!isSupabaseConfigured) {
    return { error: "Supabase is not configured yet. Add your project keys to .env.local." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim() || username;
  const referralCode = String(formData.get("referral_code") ?? "").trim();
  const next = safeNext(formData.get("next"));

  if (username.length < 3 || username.length > 24) {
    return { error: "Username must be 3–24 characters." };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { error: "Username may only contain letters, numbers and underscores." };
  }
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  if (!supabase) return { error: "Authentication is unavailable right now." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: displayName,
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/login?verified=1`,
    },
  });

  if (error) return { error: error.message };

  if (data.session) {
    redirect(next);
  }

  return {
    message:
      "Account created. Check your inbox to verify your email, then sign in.",
  };
}

export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();
  const blocked = await guardAuthRateLimit(ip, "reset");
  if (blocked) return { error: blocked };

  if (!isSupabaseConfigured) {
    return { error: "Supabase is not configured yet. Add your project keys to .env.local." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  if (!supabase) return { error: "Authentication is unavailable right now." };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/settings`,
  });

  // Never reveal whether an address exists.
  if (error) return { error: error.message };

  return { message: "If that address has an account, a reset link is on its way." };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
