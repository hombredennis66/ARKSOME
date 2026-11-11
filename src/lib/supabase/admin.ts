import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isServiceRoleConfigured, serviceRoleKey, supabaseUrl } from "./config";
import type { Database } from "@/lib/database.types";

/**
 * Privileged server-only client (service role key).
 *
 * Rules:
 * - Never import this from a "use client" file.
 * - Never use it to change a user's coin balance directly. All balance
 *   changes go through the claim_reward() database function so that caps,
 *   idempotency and the immutable ledger are enforced in one transaction.
 * - Use it only for privileged admin reads/writes and audit logging where
 *   the caller has already been authorized on the server.
 */
export function getServiceClient(): ReturnType<typeof createSupabaseClient<Database>> | null {
  if (!isServiceRoleConfigured || !supabaseUrl) return null;

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Throws when a privileged path is used without the service role key. */
export function requireServiceClient() {
  const client = getServiceClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Server-side privileged actions are unavailable.",
    );
  }
  return client;
}
