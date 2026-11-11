import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/database.types";

export type AuthedUser = {
  id: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  balance: number;
  isBanned: boolean;
};

/**
 * Resolve the current session user with role and wallet balance.
 * Wrapped in React `cache()` so multiple calls in one request hit the DB once.
 */
export const getAuthedUser = cache(async (): Promise<AuthedUser | null> => {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, roleRes, walletRes] = await Promise.all([
    supabase.from("profiles").select("display_name, username, avatar_url, is_banned").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  // A user can temporarily have multiple role rows during an admin update.
  // Resolve the strongest role instead of trusting insertion order.
  const rolePriority: UserRole[] = ["super_admin", "admin", "moderator", "member"];
  const role = rolePriority.find((candidate) =>
    (roleRes.data ?? []).some((row) => row.role === candidate),
  ) ?? "member";

  return {
    id: user.id,
    email: user.email ?? null,
    role,
    displayName: profileRes.data?.display_name ?? null,
    username: profileRes.data?.username ?? null,
    avatarUrl: profileRes.data?.avatar_url ?? null,
    balance: walletRes.data?.balance ?? 0,
    isBanned: profileRes.data?.is_banned ?? false,
  };
});

/** Redirect to /login (preserving `next`) when signed out. */
export async function requireUser(next?: string): Promise<AuthedUser> {
  const user = await getAuthedUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

const ADMIN_ROLES: UserRole[] = ["admin", "super_admin"];
const MODERATOR_ROLES: UserRole[] = ["moderator", ...ADMIN_ROLES];

/** Server-side authorization for the /admin area. Hiding links is never enough. */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (!ADMIN_ROLES.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function requireModerator(): Promise<AuthedUser> {
  const user = await requireUser();
  if (!MODERATOR_ROLES.includes(user.role)) redirect("/dashboard");
  return user;
}

/** True when Supabase credentials are present so UI can show setup hints. */
export function isMember(role: UserRole) {
  return role === "member";
}
