import Link from "next/link";
import { CheckCircle2, Server, XCircle } from "lucide-react";
import { SettingsAuditForm } from "@/components/admin/settings-audit-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { COIN_NAME, COIN_DISCLAIMER, SITE_NAME, TAGLINE } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Booleans only — secret values are never rendered or logged. */
const envReadiness = [
  { label: "NEXT_PUBLIC_SUPABASE_URL", set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
  { label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
  { label: "SUPABASE_SERVICE_ROLE_KEY", set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
  { label: "NEXT_PUBLIC_SITE_URL", set: Boolean(process.env.NEXT_PUBLIC_SITE_URL) },
];

export default async function AdminSettingsPage() {
  await requireAdmin();
  const missingCount = envReadiness.filter((entry) => !entry.set).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform identity (read-only for now) and environment readiness.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Site identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <span className="text-muted-foreground">Site name</span>
              <span className="font-semibold">{SITE_NAME}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <span className="text-muted-foreground">Tagline</span>
              <span className="text-right font-medium">{TAGLINE}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Currency</span>
              <Badge variant="coin">{COIN_NAME} (AC)</Badge>
            </div>
            <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              {COIN_DISCLAIMER}
            </p>
            <p className="text-xs text-muted-foreground">
              Editing these values requires a persisted settings table — it is read-only until then.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Server className="size-4 text-primary" aria-hidden />
              Environment readiness
            </CardTitle>
            <Badge variant={missingCount === 0 ? "success" : "warning"}>
              {missingCount === 0 ? "ready" : `${missingCount} missing`}
            </Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {envReadiness.map((entry) => (
                <li key={entry.label} className="flex items-center justify-between gap-3">
                  <code className="break-all rounded bg-muted px-1.5 py-0.5 text-xs">{entry.label}</code>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${entry.set ? "text-success" : "text-destructive"}`}>
                    {entry.set ? <CheckCircle2 className="size-3.5" aria-hidden /> : <XCircle className="size-3.5" aria-hidden />}
                    {entry.set ? "set" : "not set"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Only presence flags are shown — secret values never leave the server.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit path check</CardTitle>
          <p className="text-sm text-muted-foreground">
            Writes a <code className="font-mono">settings_update</code> entry to{" "}
            <code className="font-mono">audit_logs</code> via{" "}
            <code className="font-mono">log_admin_action()</code> to prove the audit pipeline works
            end to end. It does not change any real configuration.
          </p>
        </CardHeader>
        <CardContent>
          <SettingsAuditForm />
          <p className="mt-3 text-xs text-muted-foreground">
            After recording an entry, open{" "}
            <Link href="/admin/audit-logs?action=settings_update" className="font-medium text-primary hover:underline">
              audit logs filtered by settings_update
            </Link>{" "}
            to verify it landed with your account as the actor.
          </p>
        </CardContent>
      </Card>

      <Alert variant="info">
        <AlertTitle>Why so much is read-only</AlertTitle>
        <AlertDescription>
          There is no persisted platform-settings table yet. Site name and tagline come from code
          constants, and this page deliberately avoids inventing storage that migrations do not
          define. Add a <code className="font-mono">platform_settings</code> table in a migration to
          make these editable.
        </AlertDescription>
      </Alert>
    </div>
  );
}
