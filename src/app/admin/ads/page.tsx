import { CampaignManager } from "@/components/admin/campaign-manager";
import { PlacementToggle } from "@/components/admin/placement-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AdPlacement, Campaign } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function AdminAdsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const serviceReady = Boolean(getServiceClient());

  let placements: AdPlacement[] = [];
  let campaigns: Campaign[] = [];
  let loadError: string | null = null;

  if (supabase) {
    const [placementsRes, campaignsRes] = await Promise.all([
      supabase.from("ad_placements").select("*").order("key", { ascending: true }),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (placementsRes.error) loadError = placementsRes.error.message;
    else if (campaignsRes.error) loadError = campaignsRes.error.message;
    placements = placementsRes.data ?? [];
    campaigns = campaignsRes.data ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ads & campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placement switches, sponsor campaigns and the policy guardrails around both.
        </p>
      </div>

      <Alert variant="warning">
        <AlertTitle>Ad policy notice</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>
            Ad placements stay <strong>disabled until Google policy review/approval</strong> — do not
            enable a placement before the corresponding ad unit is approved.
          </p>
          <p>
            Rewarded ads are <strong>never required</strong> for users: every reward on ARKSOME can
            be earned through optional activities, and no user must watch or click an ad to progress.
          </p>
        </AlertDescription>
      </Alert>

      {!supabase && (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Ad management becomes available once the project is connected.</AlertDescription>
        </Alert>
      )}

      {supabase && !serviceReady && (
        <Alert variant="warning">
          <AlertTitle>Privileged access unavailable</AlertTitle>
          <AlertDescription>
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is not set — placement and
            campaign changes will be rejected until it is configured in{" "}
            <code className="font-mono">.env.local</code>.
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Failed to load ads data</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <section aria-label="Ad placements">
        <Card>
          <CardHeader>
            <CardTitle>Ad placements</CardTitle>
            <p className="text-sm text-muted-foreground">
              Master switches per placement. New placements default to disabled.
            </p>
          </CardHeader>
          <CardContent>
            {placements.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No placements defined yet. Seed them in a migration or via the Supabase dashboard.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {placements.map((placement) => (
                  <li key={placement.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {placement.name}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{placement.key}</code>
                        <Badge variant="outline">{placement.format}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">Location: {placement.location}</p>
                    </div>
                    <PlacementToggle id={placement.id} enabled={placement.enabled} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Campaigns" className="pt-2">
        <CampaignManager campaigns={campaigns} serviceReady={serviceReady} />
      </section>
    </div>
  );
}
