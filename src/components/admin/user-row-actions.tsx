"use client";

import { useState, type FormEvent } from "react";
import { Ban, ShieldCheck, Undo2 } from "lucide-react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select } from "@/components/ui/input";
import { adminAdjustBalance, adminSetBanned, adminSetRole } from "@/lib/actions/admin";
import { adminAdjustUsdBalance } from "@/lib/actions/usd";
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
  const [usdRequestId, setUsdRequestId] = useState(() => crypto.randomUUID());

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

  async function handleUsdAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const result = await run(() => adminAdjustUsdBalance(
      userId,
      String(values.get("usd_amount") ?? ""),
      String(values.get("usd_direction") ?? "credit") as "credit" | "debit",
      String(values.get("usd_reason") ?? ""),
      usdRequestId,
    ));
    if (result.ok) {
      form.reset();
      setUsdRequestId(crypto.randomUUID());
    }
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
        <summary className="cursor-pointer text-xs font-medium">
          Adjust AC balance
        </summary>
        <form onSubmit={handleBalanceAdjust} className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`amount-${userId}`} className="text-xs text-muted-foreground">
                Amount (AC)
              </Label>
              <Input
                id={`amount-${userId}`}
                name="amount"
                type="number"
                step="1"
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

      <details className="rounded-md border border-border bg-muted/50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium">Adjust simulated USD</summary>
        <form onSubmit={handleUsdAdjust} className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`usd-direction-${userId}`} className="text-xs text-muted-foreground">Operation</Label>
              <Select id={`usd-direction-${userId}`} name="usd_direction" className="mt-1 h-8 text-xs" disabled={pending}>
                <option value="credit">Credit</option><option value="debit">Debit</option>
              </Select>
            </div>
            <div>
              <Label htmlFor={`usd-amount-${userId}`} className="text-xs text-muted-foreground">Amount (USD)</Label>
              <Input id={`usd-amount-${userId}`} name="usd_amount" type="number" min="0.01" max="1000000" step="0.01" required placeholder="5.00" className="mt-1 h-8 text-xs" disabled={pending} />
            </div>
          </div>
          <div>
            <Label htmlFor={`usd-reason-${userId}`} className="text-xs text-muted-foreground">Reason</Label>
            <Input id={`usd-reason-${userId}`} name="usd_reason" required minLength={3} maxLength={500} placeholder="Support correction" className="mt-1 h-8 text-xs" disabled={pending} />
          </div>
          <Button size="sm" type="submit" disabled={pending} className="w-full">{pending ? "Applying…" : "Apply USD adjustment"}</Button>
        </form>
      </details>

      <ActionFeedback feedback={feedback} />
    </div>
  );
}
