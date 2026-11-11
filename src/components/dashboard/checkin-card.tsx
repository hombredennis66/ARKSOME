"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Flame, Loader2 } from "lucide-react";
import { claimDailyCheckin } from "@/lib/actions/rewards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Feedback = { kind: "success" | "error"; text: string };

function friendlyError(error?: string) {
  if (!error) return "The claim failed. Please try again.";
  if (error.includes("daily_limit_reached")) return "You have already checked in today.";
  if (error.includes("not_available")) return "Daily check-in is not available right now.";
  if (error.includes("per_user_limit_reached")) return "You have reached the check-in reward limit.";
  return error;
}

/**
 * Daily check-in widget. The balance is only ever changed by the server
 * action — this component just calls it and reports the result.
 */
export function CheckinCard({
  alreadyClaimed,
  initialStreak,
}: {
  alreadyClaimed: boolean;
  initialStreak: number;
}) {
  const [claimed, setClaimed] = useState(alreadyClaimed);
  const [streak, setStreak] = useState(initialStreak);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClaim() {
    setFeedback(null);
    startTransition(async () => {
      const result = await claimDailyCheckin();
      if (result.ok) {
        setClaimed(true);
        const nextStreak = (result.meta as { streak?: number } | undefined)?.streak;
        if (typeof nextStreak === "number") setStreak(nextStreak);
        setFeedback({ kind: "success", text: result.message ?? "Checked in!" });
      } else {
        setFeedback({ kind: "error", text: friendlyError(result.error) });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            Daily check-in
            {streak > 0 && (
              <Badge variant="coin">
                <Flame className="size-3" aria-hidden />
                {streak} day{streak === 1 ? "" : "s"} streak
              </Badge>
            )}
          </CardTitle>
          {claimed && (
            <Badge variant="success">
              <Check className="size-3" aria-hidden /> Checked in today
            </Badge>
          )}
        </div>
        <CardDescription>
          Claim once per calendar day to keep your streak alive. Every 7-day streak milestone adds a
          bonus.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button variant="coin" onClick={handleClaim} disabled={pending || claimed}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {claimed ? "Come back tomorrow" : pending ? "Claiming…" : "Claim today's check-in"}
        </Button>
        <Link href="/wallet" className="text-sm font-medium text-primary hover:underline">
          View wallet →
        </Link>
      </CardContent>
      <div aria-live="polite" className="px-5 pb-5 text-sm">
        {feedback && (
          <p className={feedback.kind === "success" ? "text-success" : "text-destructive"}>
            {feedback.text}
          </p>
        )}
      </div>
    </Card>
  );
}
