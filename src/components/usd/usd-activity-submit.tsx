"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { memberSubmitUsdActivity } from "@/lib/actions/usd";

type Config = { id: string; category: string; label: string; amount_cents: number };
export function UsdActivitySubmit({ config }: { config: Config }) {
  const [pending, setPending] = useState(false); const [feedback, setFeedback] = useState(""); const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const result = await memberSubmitUsdActivity(
        config.id,
        String(form.get("details") ?? ""),
        String(form.get("reference") ?? ""),
      );

      setFailed(!result.ok);
      setFeedback(result.message ?? result.error ?? "");

      if (result.ok) formElement.reset();
    } catch {
      setFailed(true);
      setFeedback("Submission failed unexpectedly. Please retry.");
    } finally {
      setPending(false);
    }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
    <div><p className="text-xs uppercase text-muted-foreground">{config.category.replaceAll("_", " ")}</p><h2 className="font-semibold">{config.label}</h2><p className="text-sm text-muted-foreground">${(config.amount_cents / 100).toFixed(2)} TEST if approved</p></div>
    <div><Label htmlFor={`details-${config.id}`}>Completion details</Label><Textarea id={`details-${config.id}`} name="details" required maxLength={3000} placeholder="Describe what you completed and how it can be verified." disabled={pending} /></div>
    <div><Label htmlFor={`reference-${config.id}`}>Unique activity reference</Label><Input id={`reference-${config.id}`} name="reference" required maxLength={300} placeholder="Completion ID or evidence link" disabled={pending} /><p className="mt-1 text-xs text-muted-foreground">Use the same reference if retrying; duplicate references cannot earn twice.</p></div>
    <Button type="submit" size="sm" disabled={pending}>{pending ? "Submitting…" : "Submit for review"}</Button>
    {feedback && <p role="status" className={failed ? "text-sm text-destructive" : "text-sm text-success"}>{feedback}</p>}
  </form>;
}
