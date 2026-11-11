"use client";

import type { FormEvent } from "react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { adminUpdateRewardConfig, type RewardConfigInput } from "@/lib/actions/admin";
import type { RewardConfig } from "@/lib/database.types";

/** Inline edit form for one reward_configs row. */
export function RewardConfigForm({
  config,
  serviceReady,
}: {
  config: RewardConfig;
  serviceReady: boolean;
}) {
  const { run, pending, feedback } = useAdminAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const dailyRaw = String(formData.get("daily_limit") ?? "").trim();
    const perUserRaw = String(formData.get("per_user_limit") ?? "").trim();
    const payload: RewardConfigInput = {
      amount: Number(formData.get("amount")),
      daily_limit: dailyRaw === "" ? null : Number(dailyRaw),
      per_user_limit: perUserRaw === "" ? null : Number(perUserRaw),
      enabled: formData.get("enabled") === "on",
      description: String(formData.get("description") ?? "").trim() || null,
    };
    await run(() => adminUpdateRewardConfig(config.id, payload));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div>
        <Label htmlFor={`amount-${config.id}`} className="mb-1.5 block text-xs text-muted-foreground">
          Amount (AC)
        </Label>
        <Input
          id={`amount-${config.id}`}
          name="amount"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={config.amount}
          disabled={pending || !serviceReady}
          className="h-9"
        />
      </div>
      <div>
        <Label htmlFor={`daily-${config.id}`} className="mb-1.5 block text-xs text-muted-foreground">
          Daily limit
        </Label>
        <Input
          id={`daily-${config.id}`}
          name="daily_limit"
          type="number"
          min={0}
          step={1}
          defaultValue={config.daily_limit ?? ""}
          placeholder="none"
          disabled={pending || !serviceReady}
          className="h-9"
        />
      </div>
      <div>
        <Label htmlFor={`peruser-${config.id}`} className="mb-1.5 block text-xs text-muted-foreground">
          Per-user limit
        </Label>
        <Input
          id={`peruser-${config.id}`}
          name="per_user_limit"
          type="number"
          min={0}
          step={1}
          defaultValue={config.per_user_limit ?? ""}
          placeholder="none"
          disabled={pending || !serviceReady}
          className="h-9"
        />
      </div>
      <div className="lg:col-span-2">
        <Label htmlFor={`desc-${config.id}`} className="mb-1.5 block text-xs text-muted-foreground">
          Description
        </Label>
        <Input
          id={`desc-${config.id}`}
          name="description"
          defaultValue={config.description ?? ""}
          maxLength={500}
          disabled={pending || !serviceReady}
          className="h-9"
          placeholder="Shown to members"
        />
      </div>
      <div className="flex items-end gap-3">
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={config.enabled}
            disabled={pending || !serviceReady}
            className="size-4 rounded border-input"
          />
          Enabled
        </label>
        <Button type="submit" size="sm" disabled={pending || !serviceReady} className="ml-auto">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <div className="sm:col-span-2 lg:col-span-6">
        <ActionFeedback feedback={feedback} />
      </div>
    </form>
  );
}
