"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * Renders the member's invite link (built from the current origin so it works
 * on any host) and copies it to the clipboard.
 */
export function ReferralLink({ code }: { code: string | null }) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  if (!code) {
    return (
      <p className="text-sm text-muted-foreground">
        Your referral code is not available yet — it is created automatically when your account is
        set up. Check back soon.
      </p>
    );
  }

  const link = origin ? `${origin}/register?ref=${code}` : null;

  async function handleCopy() {
    if (!link) return;
    setError(null);
    setCopying(true);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Copying is not allowed by your browser — select the link and copy it manually.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div>
      <Label htmlFor="referral-link">Your referral link</Label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id="referral-link"
          readOnly
          value={link ?? "…"}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono"
        />
        <Button variant="default" onClick={handleCopy} disabled={!link || copying}>
          {copying ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : copied ? (
            <Check aria-hidden />
          ) : (
            <Copy aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Code: <span className="font-mono font-medium text-foreground">{code}</span> — share the link
        and the referral is attributed automatically when someone joins.
      </p>
      <div aria-live="polite" className="mt-1 text-sm">
        {copied && <p className="text-success">Link copied to your clipboard.</p>}
        {error && <p className="text-destructive">{error}</p>}
      </div>
    </div>
  );
}
