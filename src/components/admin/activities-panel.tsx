"use client";

import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { adminSaveActivity, adminSetActivityEnabled, type ActivityInput } from "@/lib/actions/admin";
import type { Activity } from "@/lib/database.types";
import { formatCoins } from "@/lib/utils";

const ACTIVITY_TYPES = ["checkin", "quiz", "referral", "read", "ad", "streak"];

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-1.5 block">
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Activities manager: list, inline create/edit form and enable toggles. */
export function ActivitiesPanel({ activities, serviceReady }: { activities: Activity[]; serviceReady: boolean }) {
  const { run, pending, feedback } = useAdminAction();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = editingId ? (activities.find((activity) => activity.id === editingId) ?? null) : null;
  const open = creating || editing !== null;

  function closeForm() {
    setCreating(false);
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: ActivityInput = {
      key: String(formData.get("key") ?? ""),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "").trim() || null,
      activity_type: String(formData.get("activity_type") ?? "checkin"),
      reward_amount: Number(formData.get("reward_amount")),
      enabled: formData.get("enabled") === "on",
      position: Number(formData.get("position")),
    };
    const result = await run(() => adminSaveActivity(editingId, payload));
    if (result.ok) {
      form.reset();
      closeForm();
    }
  }

  async function handleToggle(activity: Activity) {
    await run(() => adminSetActivityEnabled(activity.id, !activity.enabled));
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Activities</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            What members can do to earn ARKSOME Coins (AC).
          </p>
        </div>
        <Button
          size="sm"
          disabled={!serviceReady || pending || open}
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" />
          New activity
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!serviceReady && (
          <Alert variant="warning">
            <AlertDescription>
              <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is not set — activity
              changes are unavailable (the table has no admin write policy for session clients).
            </AlertDescription>
          </Alert>
        )}

        {activities.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No activities defined yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {activities.map((activity) => (
              <li key={activity.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {activity.title}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{activity.key}</code>
                    <Badge variant={activity.enabled ? "success" : "muted"}>
                      {activity.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.activity_type} · pays {formatCoins(activity.reward_amount)} · position{" "}
                    {activity.position}
                    {activity.description ? ` · ${activity.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!serviceReady || pending}
                    onClick={() => {
                      setCreating(false);
                      setEditingId(activity.id);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={activity.enabled ? "secondary" : "default"}
                    disabled={!serviceReady || pending}
                    onClick={() => void handleToggle(activity)}
                  >
                    {activity.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {open && (
          <form
            key={editing?.id ?? "new-activity"}
            onSubmit={handleSubmit}
            className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 md:grid-cols-2"
          >
            <div className="flex items-center justify-between md:col-span-2">
              <p className="text-sm font-semibold">{editing ? "Edit activity" : "New activity"}</p>
              <Button size="icon" variant="ghost" type="button" onClick={closeForm} aria-label="Close form">
                <X className="size-4" />
              </Button>
            </div>

            <Field label="Key" htmlFor="activity-key" hint="Stable identifier, e.g. daily_checkin.">
              <Input id="activity-key" name="key" required defaultValue={editing?.key ?? ""} disabled={pending} placeholder="daily_checkin" />
            </Field>
            <Field label="Title" htmlFor="activity-title">
              <Input id="activity-title" name="title" required maxLength={160} defaultValue={editing?.title ?? ""} disabled={pending} />
            </Field>
            <Field label="Type" htmlFor="activity-type">
              <Input
                id="activity-type"
                name="activity_type"
                list="activity-type-options"
                required
                defaultValue={editing?.activity_type ?? "checkin"}
                disabled={pending}
              />
              <datalist id="activity-type-options">
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reward (AC)" htmlFor="activity-reward">
                <Input id="activity-reward" name="reward_amount" type="number" min={0} step={1} required defaultValue={editing?.reward_amount ?? 0} disabled={pending} />
              </Field>
              <Field label="Position" htmlFor="activity-position">
                <Input id="activity-position" name="position" type="number" step={1} required defaultValue={editing?.position ?? 0} disabled={pending} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Description" htmlFor="activity-description">
                <Textarea id="activity-description" name="description" rows={2} maxLength={500} defaultValue={editing?.description ?? ""} disabled={pending} />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="enabled" defaultChecked={editing?.enabled ?? true} disabled={pending} className="size-4 rounded border-input" />
                Enabled
              </label>
              <Button type="submit" size="sm" disabled={pending}>
                <Check className="size-4" />
                {pending ? "Saving…" : editing ? "Save activity" : "Create activity"}
              </Button>
            </div>
            <div className="md:col-span-2">
              <ActionFeedback feedback={feedback} />
            </div>
          </form>
        )}

        {!open && <ActionFeedback feedback={feedback} />}
      </CardContent>
    </Card>
  );
}
