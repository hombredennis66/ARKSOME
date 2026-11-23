import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UsdRewardsManager } from "@/components/admin/usd-rewards-manager";

export const dynamic = "force-dynamic";
export default async function AdminUsdRewardsPage() {
  await requireAdmin();
  const service = getServiceClient();
  if (!service) return <Alert variant="warning"><AlertTitle>Privileged access unavailable</AlertTitle><AlertDescription>Configure the service-role key on the server to manage USD activities and review submissions.</AlertDescription></Alert>;
  const [
    { data: configs, error: configError },
    { data: pending, error: submissionError },
    { data: history, error: historyError },
  ] = await Promise.all([
    service.from("usd_reward_configs").select("id,key,category,label,amount_cents,enabled,daily_limit,per_user_limit").order("created_at", { ascending: false }),
    service.from("usd_reward_submissions").select("id,user_id,details,activity_reference,reward_cents,created_at,config_id").eq("status", "pending").order("created_at", { ascending: true }).limit(100),
    service.from("usd_reward_submissions").select("id,user_id,details,activity_reference,reward_cents,created_at,config_id,status,reviewed_by,reviewed_at,review_note").not("reviewed_at", "is", null).order("reviewed_at", { ascending: false }).limit(100),
  ]);
  if (configError || submissionError || historyError) {
    console.error("[admin] USD rewards query failed:", {
      configError: configError?.message,
      submissionError: submissionError?.message,
      historyError: historyError?.message,
    });

    return (
      <Alert variant="error">
        <AlertTitle>Unable to load USD rewards</AlertTitle>
        <AlertDescription>
          The activity configurations or submissions could not be loaded. Check the server logs.
        </AlertDescription>
      </Alert>
    );
  }
  const configLabels = new Map((configs ?? []).map((config) => [config.id, config.label]));
  const memberIds = [...new Set([...(pending ?? []), ...(history ?? [])].map((row) => row.user_id))];
  const [{ data: profiles, error: profileError }, { data: accounts, error: accountError }] = memberIds.length
    ? await Promise.all([
        service.from("profiles").select("id,username,display_name").in("id", memberIds),
        service.from("account_records").select("id,deleted_at").in("id", memberIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (profileError || accountError) {
    console.error("[admin] USD rewards member lookup failed:", { profileError: profileError?.message, accountError: accountError?.message });
    return <Alert variant="error"><AlertTitle>Unable to load USD rewards</AlertTitle><AlertDescription>Submission account details could not be loaded. Check the server logs.</AlertDescription></Alert>;
  }
  const memberLabels = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.username || profile.id]));
  const deletedAccounts = new Set((accounts ?? []).filter((account) => account.deleted_at !== null).map((account) => account.id));
  const decorate = (row: NonNullable<typeof pending>[number]) => ({
    ...row,
    config_label: configLabels.get(row.config_id) ?? "Activity",
    user_label: memberLabels.get(row.user_id) ?? row.user_id,
    account_deleted: deletedAccounts.has(row.user_id),
  });
  const submissions = (pending ?? []).map(decorate);
  const reviewedSubmissions = (history ?? []).map(decorate);
  return <div className="space-y-6"><header><h1 className="text-2xl font-bold">Simulated USD wallet</h1><p className="mt-1 text-sm text-muted-foreground">Configure eligible activity rewards and review member submissions. Values are simulated test ledger amounts only.</p></header><UsdRewardsManager configs={configs ?? []} submissions={submissions} history={reviewedSubmissions} /></div>;
}
