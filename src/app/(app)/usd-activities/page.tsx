import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsdActivitySubmit } from "@/components/usd/usd-activity-submit";
import { formatCoins, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function UsdActivitiesPage() {
  const user = await requireUser("/usd-activities");
  const supabase = await createClient();
  if (!supabase) return <p>Wallet services are unavailable right now.</p>;
  const [{ data: configs }, { data: submissions }] = await Promise.all([
    supabase.from("usd_reward_configs").select("id,category,label,amount_cents").eq("enabled", true).order("category").order("label"),
    supabase.from("usd_reward_submissions").select("id,status,reward_cents,created_at,review_note").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold">Simulated USD activities</h1><p className="mt-1 text-sm text-muted-foreground">Submissions are reviewed by an administrator before any simulated USD is credited. No cash value.</p></header>
    {configs?.length ? <div className="grid gap-4 md:grid-cols-2">{configs.map((config) => <UsdActivitySubmit key={config.id} config={config} />)}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No USD earning activities are available right now.</p>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Recent submissions</h2>{submissions?.length ? submissions.map((submission) => <article key={submission.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border p-3 text-sm"><span className="capitalize">{submission.status}{submission.review_note ? ` · ${submission.review_note}` : ""}</span><span>{formatCoins(submission.reward_cents)} · {formatDate(submission.created_at)}</span></article>) : <p className="text-sm text-muted-foreground">No submissions yet.</p>}</section>
  </div>;
}
