import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";
import type { Database } from "@/lib/database.types";

/**
 * Server-side client for Server Components and Server Actions.
 * Uses the user's own session cookie, so RLS applies normally.
 * Returns null when Supabase is not configured yet.
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: session refresh is handled by proxy.ts.
        }
      },
    },
  });
}
