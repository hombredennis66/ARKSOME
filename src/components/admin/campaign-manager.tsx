"use client";

import { useState, type FormEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { adminSaveCampaign, type CampaignInput } from "@/lib/actions/admin";
import type { Campaign } from "@/lib/database.types";
import { formatCoins, formatDate } from "@/lib/utils";

const STATUSES: Campaign["status"][] = ["draft", "active", "paused", "ended"];

const STATUS_VARIANT: Record<Campaign["status"], "muted" | "success" | "warning" | "outline"> = {
  draft: "muted",
  active: "success",
  paused: "warning",
  ended: "outline",
};

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

/** Campaign list with an inline create/edit form (admin-only writes). */
export function CampaignManager({ campaigns, serviceReady }: { campaigns: Campaign[]; serviceReady: boolean }) {
  const { run, pending, feedback } = useAdminAction();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const open = creating || editingId !== null;
  const editing = editingId ? (campaigns.find((campaign) => campaign.id === editingId) ?? null) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const budgetRaw = String(formData.get("budget_coins") ?? "").trim();
    const payload: CampaignInput = {
      name: String(formData.get("name") ?? ""),
      sponsor: String(formData.get("sponsor") ?? "").trim() || null,
      status: String(formData.get("status") ?? "draft") as Campaign["status"],
      starts_at: String(formData.get("starts_at") ?? "") || null,
      ends_at: String(formData.get("ends_at") ?? "") || null,
      budget_coins: budgetRaw === "" ? null : Number(budgetRaw),
    };
    const result = await run(() => adminSaveCampaign(editingId, payload));
    if (result.ok) {
      form.reset();
      setCreating(false);
      setEditingId(null);
    }
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Sponsor campaigns measured in ARKSOME Coins (AC) — internal points with no cash value.
          </p>
        </div>
        <Button
          disabled={!serviceReady || pending || open}
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" />
          New campaign
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No campaigns yet. Create one to schedule sponsor placements.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Campaign</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Dates</th>
                    <th className="px-4 py-3 font-semibold">Budget</th>
                    <th className="px-4 py-3 font-semibold">Performance</th>
                    <th className="px-4 py-3 font-semibold" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.sponsor ? `Sponsor: ${campaign.sponsor}` : "No sponsor recorded"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[campaign.status]}>{campaign.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(campaign.starts_at)} → {formatDate(campaign.ends_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-coin">
                        {campaign.budget_coins === null ? "—" : formatCoins(campaign.budget_coins)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {campaign.impressions.toLocaleString()} impressions ·{" "}
                        {campaign.clicks.toLocaleString()} clicks
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!serviceReady || pending}
                          onClick={() => {
                            setCreating(false);
                            setEditingId(campaign.id);
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {open && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{editing ? `Edit “${editing.name}”` : "New campaign"}</CardTitle>
            <Button size="icon" variant="ghost" onClick={closeForm} aria-label="Close form">
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <Field label="Campaign name" htmlFor="campaign-name">
                <Input id="campaign-name" name="name" required maxLength={160} defaultValue={editing?.name ?? ""} disabled={pending} />
              </Field>
              <Field label="Sponsor" htmlFor="campaign-sponsor">
                <Input id="campaign-sponsor" name="sponsor" maxLength={160} defaultValue={editing?.sponsor ?? ""} disabled={pending} placeholder="Sponsor Ltd." />
              </Field>
              <Field label="Status" htmlFor="campaign-status">
                <Select id="campaign-status" name="status" defaultValue={editing?.status ?? "draft"} disabled={pending}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Budget (AC)" htmlFor="campaign-budget" hint="Internal ARKSOME Coins only — never cash.">
                <Input
                  id="campaign-budget"
                  name="budget_coins"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={editing?.budget_coins ?? ""}
                  disabled={pending}
                  placeholder="5000"
                />
              </Field>
              <Field label="Starts" htmlFor="campaign-starts">
                <Input id="campaign-starts" name="starts_at" type="date" defaultValue={dateInputValue(editing?.starts_at ?? null)} disabled={pending} />
              </Field>
              <Field label="Ends" htmlFor="campaign-ends">
                <Input id="campaign-ends" name="ends_at" type="date" defaultValue={dateInputValue(editing?.ends_at ?? null)} disabled={pending} />
              </Field>

              <div className="flex items-center gap-3 md:col-span-2">
                <Button type="submit" disabled={pending}>
                  <Check className="size-4" />
                  {pending ? "Saving…" : editing ? "Save campaign" : "Create campaign"}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm} disabled={pending}>
                  Cancel
                </Button>
              </div>
              <div className="md:col-span-2">
                <ActionFeedback feedback={feedback} />
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!open && <ActionFeedback feedback={feedback} />}
    </div>
  );
}

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
