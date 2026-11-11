/** Central place for Supabase env access + readiness checks. */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * False when credentials have not been filled in yet. The app degrades to
 * friendly setup screens / demo content instead of throwing at build time.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Server-only secret is available (used by privileged admin/reward paths). */
export const isServiceRoleConfigured = Boolean(serviceRoleKey);

export function requireSupabaseEnv() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
}
