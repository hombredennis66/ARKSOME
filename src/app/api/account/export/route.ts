import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Download the signed-in member's personal data without using service-role access. */
export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const [profile, settings, consents, wallet, transactions, rewardEvents, bookmarks, quizAttempts, checkins, referrals, notifications, reports] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("consents").select("*").eq("user_id", user.id),
    supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("coin_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("reward_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("bookmarks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("quiz_attempts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("daily_checkins").select("*").eq("user_id", user.id).order("checkin_date", { ascending: false }),
    supabase.from("referrals").select("*").or(`referrer_id.eq.${user.id},referred_id.eq.${user.id}`),
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("content_reports").select("*").eq("reporter_id", user.id).order("created_at", { ascending: false }),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
    profile: profile.data,
    settings: settings.data,
    consents: consents.data ?? [],
    wallet: wallet.data,
    coin_transactions: transactions.data ?? [],
    reward_events: rewardEvents.data ?? [],
    bookmarks: bookmarks.data ?? [],
    quiz_attempts: quizAttempts.data ?? [],
    daily_checkins: checkins.data ?? [],
    referrals: referrals.data ?? [],
    notifications: notifications.data ?? [],
    content_reports: reports.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="arksome-data-${user.id}.json"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
