"use client";

import type { FormEvent } from "react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { adminLogSettingsUpdate } from "@/lib/actions/admin";

/**
 * Proof-of-path form: writes a `settings_update` row to audit_logs through
 * log_admin_action() without changing any real platform configuration.
 */
export function SettingsAuditForm() {
  const { run, pending, feedback } = useAdminAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = await run(() =>
      adminLogSettingsUpdate(
        String(formData.get("key") ?? ""),
        String(formData.get("value") ?? ""),
      ),
    );
    if (result.ok) form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="setting-key" className="mb-1.5 block">
          Setting key
        </Label>
        <Input
          id="setting-key"
          name="key"
          required
          maxLength={60}
          disabled={pending}
          placeholder="maintenance_note"
          pattern="[a-z0-9][a-z0-9_-]{1,59}"
          title="2–60 characters: lowercase letters, numbers, _ or -"
        />
      </div>
      <div>
        <Label htmlFor="setting-value" className="mb-1.5 block">
          Value / note
        </Label>
        <Input id="setting-value" name="value" required maxLength={500} disabled={pending} placeholder="Scheduled maintenance 02:00 UTC" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Writing…" : "Record settings change"}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <ActionFeedback feedback={feedback} />
      </div>
    </form>
  );
}
