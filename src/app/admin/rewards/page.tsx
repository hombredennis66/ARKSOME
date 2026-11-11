import { Gift } from "lucide-react";
import { RewardConfigForm } from "@/components/admin/reward-config-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RewardConfig } from "@/lib/database.types";
import { rewardLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRewardsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const serviceReady = Boolean(getServiceClient());

  let configs: RewardConfig[] = [];
  let loadError: string | null = null;

  if (supabase) {
    const { data, error } = await supabase.from("reward_configs").select("*").order("key", { ascending: true });
    if (error) loadError = error.message;
    configs = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rewards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What each action pays, and the caps that keep claims fair.
        </p>
      </div>

      <Alert>
        <AlertTitle>How these values are enforced</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>
            Amounts are <strong>validated server-side</strong> — the browser never sets a balance.
            Every claim goes through the <code className="font-mono">claim_reward()</code> database
            function, which validates the configured amount, applies the daily limit and per-user
            limit, and writes the immutable ledger in one transaction.
          </p>
          <p>
            <strong>Leaving a limit empty means unlimited.</strong> Edits affect future claims only;
            existing ledger entries are append-only and cannot be rewritten.
          </p>
        </AlertDescription>
      </Alert>

      {supabase && !serviceReady && (
        <Alert variant="warning">
          <AlertTitle>Privileged access unavailable</AlertTitle>
          <AlertDescription>
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is not set, so reward
            configuration edits are disabled (the table has no admin write policy for session
            clients). Values are read-only until the key is configured.
          </AlertDescription>
        </Alert>
      )}

      {!supabase && (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Reward configuration becomes available once the project is connected.</AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Failed to load reward configs</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {supabase && configs.length === 0 && !loadError && (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No reward configurations found. Seed <code className="font-mono">reward_configs</code> via
          the migrations to enable rewards.
        </p>
      )}

      <div className="space-y-4">
        {configs.map((config) => (
          <Card key={config.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <Gift className="size-4 text-primary" aria-hidden />
                <CardTitle>{config.label}</CardTitle>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{config.key}</code>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={config.enabled ? "success" : "muted"}>
                  {config.enabled ? "enabled" : "disabled"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  shown as “{rewardLabel(config.key)}”
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <RewardConfigForm config={config} serviceReady={serviceReady} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
