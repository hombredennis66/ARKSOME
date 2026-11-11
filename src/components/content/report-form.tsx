"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { submitContentReport } from "@/lib/actions/reports";
import { Button } from "@/components/ui/button";
import { Textarea, Select } from "@/components/ui/input";

export function ReportForm({ contentId }: { contentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("misleading");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitContentReport(contentId, reason, details);
      setMessage(result.message ?? result.error ?? "Could not submit report.");
      if (result.ok) setOpen(false);
    });
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
        <Flag className="size-4" /> Report
      </Button>
      {open && (
        <div className="mt-3 rounded-lg border border-border bg-muted p-4">
          <label htmlFor="report-reason" className="text-sm font-medium">Reason</label>
          <Select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2">
            <option value="misleading">Misleading or inaccurate</option>
            <option value="harmful">Harmful or unsafe</option>
            <option value="spam">Spam or promotion</option>
            <option value="copyright">Copyright concern</option>
            <option value="other">Other</option>
          </Select>
          <label htmlFor="report-details" className="mt-3 block text-sm font-medium">Details (optional)</label>
          <Textarea id="report-details" value={details} maxLength={1000} onChange={(event) => setDetails(event.target.value)} className="mt-2" />
          <div className="mt-3 flex gap-2">
            <Button onClick={submit} disabled={pending}>{pending ? "Sending…" : "Send report"}</Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          </div>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{message}</p>}
    </div>
  );
}
