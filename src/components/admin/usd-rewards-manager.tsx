"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { adminReviewUsdActivity, adminSaveUsdRewardConfig } from "@/lib/actions/usd";
import { formatCoins, formatDate } from "@/lib/utils";

type Config = { id: string; key: string; category: string; label: string; amount_cents: number; enabled: boolean; daily_limit: number | null; per_user_limit: number | null };
type Submission = { id: string; user_id: string; user_label: string; details: string; activity_reference: string; reward_cents: number; created_at: string; config_label: string; account_deleted: boolean; status?: string; reviewed_at?: string | null; reviewed_by?: string | null; review_note?: string | null };

export function UsdRewardsManager({ configs, submissions, history }: { configs: Config[]; submissions: Submission[]; history: Submission[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState("");
  async function save(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault(); setPending(true); setFeedback(""); const form = event.currentTarget; const data = new FormData(form);
    const result = await adminSaveUsdRewardConfig({ id, key: String(data.get("key") ?? ""), category: String(data.get("category") ?? "other"), label: String(data.get("label") ?? ""), dollars: String(data.get("dollars") ?? ""), enabled: data.get("enabled") === "on", dailyLimit: String(data.get("daily_limit") ?? ""), perUserLimit: String(data.get("per_user_limit") ?? "") });
    setPending(false); setFeedback(result.message ?? result.error ?? ""); if (result.ok) { if (!id) form.reset(); router.refresh(); }
  }
  async function review(id: string, decision: "approved" | "rejected", form: HTMLFormElement) {
    setPending(true); setFeedback(""); const note = String(new FormData(form).get("note") ?? ""); const result = await adminReviewUsdActivity(id, decision, note); setPending(false); setFeedback(result.message ?? result.error ?? ""); if (result.ok) router.refresh();
  }
  return <div className="space-y-8">
    <section className="space-y-4"><div><h2 className="text-lg font-semibold">Activity reward configuration</h2><p className="text-sm text-muted-foreground">Amounts are stored as integer cents and captured server-side at submission.</p></div>
      <form onSubmit={(event) => save(event)} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <div><Label>Key</Label><Input name="key" required minLength={2} maxLength={60} pattern="[a-z0-9][a-z0-9_-]{1,59}" placeholder="ad_view" /></div>
        <div><Label>Category</Label><Select name="category"><option value="advertisements">Advertisements</option><option value="content_engagement">Content engagement</option><option value="challenges">Challenges or competitions</option><option value="other">Other authorized activity</option></Select></div>
        <div><Label>Display label</Label><Input name="label" required maxLength={160} placeholder="Watch campaign video" /></div>
        <div><Label>Reward (TEST USD)</Label><Input name="dollars" required type="number" min="0.01" max="1000000" step="0.01" placeholder="0.25" /></div>
        <div><Label>Daily limit (blank = unlimited)</Label><Input name="daily_limit" type="number" min="0" step="1" /></div>
        <div><Label>Per-member limit (blank = unlimited)</Label><Input name="per_user_limit" type="number" min="0" step="1" /></div>
        <label className="flex items-center gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked />Enabled</label>
        <div className="flex items-end"><Button type="submit" disabled={pending}>Create activity</Button></div>
      </form>
      <div className="space-y-2">{configs.map((config) => <form key={config.id} onSubmit={(event) => save(event, config.id)} className="grid items-end gap-2 rounded-lg border border-border p-3 md:grid-cols-7">
        <input type="hidden" name="key" value={config.key} /><div className="text-xs text-muted-foreground">{config.key}<br />{config.category.replaceAll("_", " ")}</div>
        <div><Label>Label</Label><Input name="label" defaultValue={config.label} required maxLength={160} /></div><div><Label>Amount (TEST USD)</Label><Input name="dollars" defaultValue={(config.amount_cents / 100).toFixed(2)} type="number" min="0.01" max="1000000" step="0.01" required /></div>
        <input type="hidden" name="category" value={config.category} /><div><Label>Daily limit</Label><Input name="daily_limit" defaultValue={config.daily_limit ?? ""} type="number" min="0" /></div><div><Label>Per member</Label><Input name="per_user_limit" defaultValue={config.per_user_limit ?? ""} type="number" min="0" /></div>
        <div className="flex items-center justify-between gap-2"><label className="flex items-center gap-1 text-xs"><input name="enabled" type="checkbox" defaultChecked={config.enabled} />Enabled</label><Button size="sm" disabled={pending}>Save</Button></div>
      </form>)}</div>
    </section>
    <section className="space-y-4"><div><h2 className="text-lg font-semibold">Pending activity submissions</h2><p className="text-sm text-muted-foreground">Review evidence before approval. A member cannot review their own submission.</p></div>
      {submissions.length ? submissions.map((submission) => <form key={submission.id} onSubmit={(e) => e.preventDefault()} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{submission.config_label}</h3><p className="text-xs text-muted-foreground">{submission.user_label} · {submission.user_id} · {formatDate(submission.created_at)}</p></div><strong>{formatCoins(submission.reward_cents)}</strong></div>
        {submission.account_deleted && <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">This account was deleted. The submission remains on file and cannot be approved.</p>}
        <p className="whitespace-pre-wrap text-sm">{submission.details}</p>{submission.activity_reference && <p className="break-all text-xs text-muted-foreground">Reference: {submission.activity_reference}</p>}
        <div><Label>Review note (optional)</Label><Textarea name="note" maxLength={1000} /></div>
        <div className="flex gap-2"><Button type="button" size="sm" disabled={pending || submission.account_deleted} onClick={(e) => review(submission.id, "approved", e.currentTarget.form!)}>Approve and credit USD</Button><Button type="button" size="sm" variant="destructive" disabled={pending} onClick={(e) => review(submission.id, "rejected", e.currentTarget.form!)}>Reject</Button></div>
      </form>) : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No pending submissions.</p>}
    </section>
    <section className="space-y-4"><div><h2 className="text-lg font-semibold">Recent reviewed submissions</h2><p className="text-sm text-muted-foreground">Recent approvals and rejections remain available for audit, including submissions from deleted accounts.</p></div>
      {history.length ? history.map((submission) => <article key={submission.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{submission.config_label} · <span className="capitalize">{submission.status}</span></h3><p className="text-xs text-muted-foreground">{submission.user_label} · {submission.user_id}{submission.account_deleted ? " · account deleted" : ""} · reviewed {submission.reviewed_at ? formatDate(submission.reviewed_at) : ""}</p></div><strong>{formatCoins(submission.reward_cents)}</strong></div>
        <p className="whitespace-pre-wrap text-sm">{submission.details}</p>
        <p className="break-all text-xs text-muted-foreground">Reference: {submission.activity_reference}</p>
        {submission.review_note && <p className="text-sm text-muted-foreground">Review note: {submission.review_note}</p>}
      </article>) : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No reviewed submissions yet.</p>}
    </section>
    {feedback && <p role="status" className="rounded-md bg-muted p-3 text-sm">{feedback}</p>}
  </div>;
}
