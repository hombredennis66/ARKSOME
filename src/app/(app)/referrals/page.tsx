import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatCoins, formatDate, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { ReferralLink } from "@/components/dashboard/referral-link";
import type { Profile, Referral, RewardConfig } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type ReferralRow = Pick<Referral, "id" | "status" | "created_at" | "credited_at" | "referred_id">;

const STATUS_BADGE: Record<Referral["status"], { label: string; variant: "success" | "warning" | "destructive" }> = {
  credited: { label: "Credited", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  rejected: { label: "Not eligible", variant: "destructive" },
};

export default async function ReferralsPage() {
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;

  const user = await requireUser("/referrals");

  const [referralsRes, profileRes, configRes] = await Promise.all([
    supabase
      .from("referrals")
      .select("id, status, created_at, credited_at, referred_id")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("reward_configs").select("*").eq("key", "referral_signup").maybeSingle(),
  ]);

  const referrals: ReferralRow[] = referralsRes.data ?? [];

  // `referral_code` exists in the schema but not in the hand-written Profile
  // type, so it is narrowed here after the fetch.
  const profile = profileRes.data as (Profile & { referral_code?: string | null }) | null;
  const referralCode = profile?.referral_code ?? null;

  const config: RewardConfig | null = configRes.data;

  // Show referred members by display name/username only — never email addresses.
  const referredIds = referrals.map((r) => r.referred_id);
  const { data: referredProfiles } =
    referredIds.length > 0
      ? await supabase.from("profiles").select("id, username, display_name").in("id", referredIds)
      : { data: null };
  const profileById = new Map((referredProfiles ?? []).map((p) => [p.id, p]));

  const total = referrals.length;
  const credited = referrals.filter((r) => r.status === "credited").length;
  const pending = referrals.filter((r) => r.status === "pending").length;

  const stats = [
    { label: "Total referrals", value: total },
    { label: "Credited", value: credited },
    { label: "Pending", value: pending },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Referrals</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Share your link with friends. When they join ARKSOME, the referral is attributed
          automatically and you earn AC once their signup is credited.
        </p>
      </div>

      {/* Link */}
      <section
        aria-labelledby="referral-link-heading"
        className="rounded-2xl border border-border bg-card p-6"
      >
        <h2 id="referral-link-heading" className="text-base font-semibold">
          Invite friends
        </h2>
        <div className="mt-3">
          <ReferralLink code={referralCode} />
        </div>
      </section>

      {/* Stats */}
      <section aria-labelledby="referral-stats-heading">
        <h2 id="referral-stats-heading" className="sr-only">
          Referral statistics
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-3xl font-bold">{formatNumber(stat.value)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reward explanation */}
      <section
        aria-labelledby="referral-reward-heading"
        className="rounded-xl border border-border bg-card p-5"
      >
        <h2 id="referral-reward-heading" className="text-base font-semibold">
          How the referral reward works
        </h2>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
          {config ? (
            <>
              <p>
                When someone joins using your link and their signup is credited, you earn{" "}
                <span className="font-semibold text-coin">{formatCoins(config.amount)}</span>.{" "}
                {config.description}
              </p>
              <ul className="list-inside list-disc space-y-1">
                {config.daily_limit !== null && (
                  <li>
                    At most {formatNumber(config.daily_limit)} referral reward
                    {config.daily_limit === 1 ? "" : "s"} per member per day.
                  </li>
                )}
                {config.per_user_limit !== null && (
                  <li>
                    At most {formatNumber(config.per_user_limit)} referral rewards per member in
                    total.
                  </li>
                )}
              </ul>
            </>
          ) : (
            <p>
              When someone joins using your link and their signup is credited, you earn ARKSOME
              Coins. Reward amounts are set by the platform and may change.
            </p>
          )}
          <p>
            Rewards are subject to limits, and referrals that look self-referred or fraudulent are
            rejected. ARKSOME Coins are internal platform points with no cash value.
          </p>
        </div>
      </section>

      {/* List */}
      <section aria-labelledby="referred-heading">
        <h2 id="referred-heading" className="mb-3 text-lg font-semibold">
          Members who joined with your link
        </h2>
        {referrals.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-medium">No referrals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your link above — every member who joins with it appears here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Member
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Credited
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrals.map((referral) => {
                  const member = profileById.get(referral.referred_id);
                  const displayName =
                    member?.display_name ?? member?.username ?? "An ARKSOME member";
                  const badge = STATUS_BADGE[referral.status];
                  return (
                    <tr key={referral.id}>
                      <td className="px-4 py-3 font-medium">{displayName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(referral.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {referral.credited_at ? formatDate(referral.credited_at) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          For privacy, only display names and usernames are shown — never email addresses.
        </p>
      </section>

      {/* Coin disclaimer */}
      <p className="rounded-xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
        Referral rewards are paid in ARKSOME Coins (AC), internal platform points that have no cash
        value and cannot be withdrawn, sold or transferred.
      </p>
    </div>
  );
}
