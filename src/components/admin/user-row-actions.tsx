"use client";

import { useState, type FormEvent } from "react";
import { Ban, ShieldCheck, Undo2 } from "lucide-react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/input";
import { adminAdjustBalance, adminSetBanned, adminSetRole } from "@/lib/actions/admin";
import type { UserRole } from "@/lib/database.types";

const ROLES: UserRole[] = ["member", "moderator", "admin", "super_admin"];

/** Per-row moderation controls: role change, ban/unban, manual AC adjustment. */
export function UserRowActions({
  userId,
  role,
  isBanned,
  isSelf,
}: {
  userId: string;
  role: UserRole;
  isBanned: boolean;
  isSelf: boolean;
}) {
  const { run, pending, feedback } = useAdminAction();
  const [selectedRole, setSelectedRole] = useState<UserRole>(role);

  async function handleRoleChange() {
    if (selectedRole === role) return;
    const result = await run(() => adminSetRole(userId, selectedRole));
    if (!result.ok) setSelectedRole(role);
  }

  async function handleBanToggle() {
    await run(() => adminSetBanned(userId, !isBanned));
  }

  async function handleBalanceAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const amount = Number(new FormData(form).get("amount"));
    const reason = String(new FormData(form).get("reason") ?? "");
    const result = await run(() => adminAdjustBalance(userId, amount, reason));
    if (result.ok) form.reset();
  }

  return (
    <div className="flex min-w-56 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          aria-label="Role"
          value={selectedRole}
          disabled={isSelf || pending}
          onChange={(event) => setSelectedRole(event.target.value as UserRole)}
          className="h-8 text-xs"
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {option.replace("_", " ")}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          variant="secondary"
          disabled={isSelf || pending || selectedRole === role}
          onClick={handleRoleChange}
        >
          <ShieldCheck className="size-3.5" />
          Set role
        </Button>
      </div>

      <Button
        size="sm"
        variant={isBanned ? "outline" : "destructive"}
        disabled={isSelf || pending}
        onClick={handleBanToggle}
      >
        {isBanned ? <Undo2 className="size-3.5" /> : <Ban className="size-3.5" />}
        {isBanned ? "Unban account" : "Ban account"}
      </Button>

      <details className="rounded-md border border-border bg-muted/50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium">Adjust balance (AC)</summary>
        <form onSubmit={handleBalanceAdjust} className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`amount-${userId}`} className="text-xs text-muted-foreground">
                Amount (±AC)
              </Label>
              <Input
                id={`amount-${userId}`}
                name="amount"
                type="number"
                step={1}
                required
                placeholder="-50"
                className="mt-1 h-8 text-xs"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor={`reason-${userId}`} className="text-xs text-muted-foreground">
                Reason
              </Label>
              <Input
                id={`reason-${userId}`}
                name="reason"
                required
                minLength={3}
                maxLength={200}
                placeholder="Support correction"
                className="mt-1 h-8 text-xs"
                disabled={pending}
              />
            </div>
          </div>
          <Button size="sm" type="submit" disabled={pending} className="w-full">
            {pending ? "Applying…" : "Apply adjustment"}
          </Button>
        </form>
      </details>

      <ActionFeedback feedback={feedback} />
    </div>
  );
}
