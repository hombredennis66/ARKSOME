import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm, ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { changePassword, deleteAccount, recordConsent, updateProfile, updateSettings } from "./actions";

function ToggleRow({
  id,
  label,
  description,
  defaultChecked,
  badge,
}: {
  id: string;
  label: string;
  description: string;
  defaultChecked: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <input
        type="checkbox"
        id={id}
        name={id}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id}>{label}</Label>
          {badge ? <Badge variant="muted">{badge}</Badge> : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>
            Add your project keys to <code className="font-mono">.env.local</code> and run the
            migrations, then come back to manage your profile, preferences and privacy choices.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const user = await getAuthedUser();
  if (!user) redirect("/login");

  const [profileRes, settingsRes, consentsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, bio, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_settings")
      .select("email_notifications, marketing_consent, rewarded_ads_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("consents")
      .select("consent_type, granted, created_at")
      .eq("user_id", user.id)
      .in("consent_type", ["cookie", "advertising"])
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileRes.data;
  const settings = settingsRes.data;
  const consents = consentsRes.data ?? [];
  const consentGranted = (type: string) =>
    consents.find((consent) => consent.consent_type === type)?.granted ?? false;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email ?? user.username ?? "member"}.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear across ARKSOME.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm action={updateProfile} submitLabel="Save profile">
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                name="display_name"
                maxLength={60}
                defaultValue={profile?.display_name ?? ""}
                placeholder="How you appear on ARKSOME"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                required
                minLength={3}
                maxLength={24}
                defaultValue={profile?.username ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                3–24 characters: letters, numbers and underscores.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                rows={3}
                maxLength={280}
                defaultValue={profile?.bio ?? ""}
                placeholder="A line or two about you"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input
                id="avatar_url"
                name="avatar_url"
                type="url"
                defaultValue={profile?.avatar_url ?? ""}
                placeholder="https://…"
              />
              <p className="text-xs text-muted-foreground">Optional — a direct link to a picture.</p>
            </div>
          </SettingsForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Email, marketing and optional rewarded ads.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm action={updateSettings} submitLabel="Save preferences">
            <ToggleRow
              id="email_notifications"
              label="Email notifications"
              description="Occasional updates about your feed, streaks and account."
              defaultChecked={settings?.email_notifications ?? true}
            />
            <ToggleRow
              id="marketing_consent"
              label="Marketing emails"
              description="News about new features and offers from ARKSOME."
              defaultChecked={settings?.marketing_consent ?? false}
            />
            <ToggleRow
              id="rewarded_ads_enabled"
              label="Rewarded ads"
              description="Optional ads you choose to watch that reward you with ARKSOME Coins (AC). Never required — turn this off whenever you like."
              defaultChecked={settings?.rewarded_ads_enabled ?? true}
              badge="Optional"
            />
          </SettingsForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy &amp; consent</CardTitle>
          <CardDescription>
            Choose how cookies and advertising are used for you. You can change these anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm action={recordConsent} submitLabel="Save consent choices">
            <ToggleRow
              id="cookie_consent"
              label="Cookie consent"
              description="Allow cookies that remember your preferences and personalise your feed."
              defaultChecked={consentGranted("cookie")}
            />
            <ToggleRow
              id="advertising_consent"
              label="Advertising consent"
              description="Allow personalised and rewarded advertising. Optional — you can decline."
              defaultChecked={consentGranted("advertising")}
            />
          </SettingsForm>
          <p className="mt-3 text-xs text-muted-foreground">
            Each choice is stored with the date you made it.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Change the password you sign in with.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm action={changePassword} submitLabel="Change password">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm new password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </SettingsForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Pick how ARKSOME looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>Download a copy of the personal data associated with your ARKSOME account.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The export includes your account profile, preferences, consent history, wallet ledger,
            activities, bookmarks, notifications, referrals and reports. It does not include other
            members&apos; information.
          </p>
          <a
            href="/api/account/export"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Download my data
          </a>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Danger zone
            <Badge variant="destructive">Irreversible</Badge>
          </CardTitle>
          <CardDescription>Permanent actions — please read carefully.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Deleting your account removes your profile, bookmarks, settings and wallet balance,
            including any ARKSOME Coins (AC) you have earned. AC are internal points with no cash
            value and cannot be withdrawn. Deletions cannot be undone.
          </p>
          <p className="text-sm text-muted-foreground">
            This permanently removes your authentication account and associated ARKSOME records.
            Any legally-required operational records may be retained in a minimized form.
          </p>
          <SettingsForm action={deleteAccount} submitLabel="Delete account permanently">
            <div className="space-y-1.5">
              <Label htmlFor="confirmation">Type DELETE MY ACCOUNT to confirm</Label>
              <Input
                id="confirmation"
                name="confirmation"
                required
                autoComplete="off"
                placeholder="DELETE MY ACCOUNT"
              />
            </div>
          </SettingsForm>
          <p className="text-xs text-muted-foreground">
            If deletion is unavailable, contact{" "}
            <a href="mailto:privacy@arksome.example" className="text-primary underline-offset-4 hover:underline">
              privacy@arksome.example
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
