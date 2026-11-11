"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, Trophy } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { submitQuiz } from "@/lib/actions/rewards";
import { formatCoins } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type QuizRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  reward_amount: number;
  max_attempts_per_day: number;
  questions: QuizQuestion[];
};

type Feedback = { kind: "success" | "error"; text: string };

type Result = {
  correct: number;
  total: number;
  coins: number;
  balance: number | undefined;
};

/** Maps raw server error strings to copy a member can act on. */
function friendlyError(error?: string) {
  if (!error) return "The quiz could not be submitted. Please try again.";
  if (error.includes("attempts_exhausted")) {
    return "You have used all your attempts for this quiz today. Come back tomorrow to try again.";
  }
  if (error.includes("quiz_not_found")) return "This quiz is no longer available.";
  if (error.includes("invalid_submission")) {
    return "Your answers could not be verified — please submit again.";
  }
  if (error.includes("daily_limit_reached") || error.includes("per_user_limit_reached")) {
    return "You have reached today's quiz reward cap. You can still play, but no more AC can be added today.";
  }
  if (error.includes("not_available")) return "This quiz's rewards are not available right now.";
  return error;
}

/**
 * Interactive quiz. The `answers` column is never granted to clients, so the
 * questions are fetched here (question text only) and grading happens on the
 * server inside submitQuiz().
 */
export function QuizPlayer({
  slug,
  title,
  description,
  rewardAmount,
  maxAttempts,
}: {
  slug: string;
  title: string;
  description: string | null;
  rewardAmount: number;
  maxAttempts: number;
}) {
  const [phase, setPhase] = useState<"idle" | "loading" | "playing" | "done">("idle");
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  function startQuiz() {
    setFeedback(null);
    setPhase("loading");
    const client = getSupabaseBrowserClient();
    if (!client) {
      setFeedback({ kind: "error", text: "Supabase is not configured yet." });
      setPhase("idle");
      return;
    }

    // NOTE: the `answers` column is deliberately never selected — the server
    // grades submissions so the answer key never reaches the browser.
    void (async () => {
      const { data, error } = await client
        .from("quizzes")
        .select("id, slug, title, description, reward_amount, max_attempts_per_day, questions")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setFeedback({ kind: "error", text: error?.message ?? "This quiz could not be loaded." });
        setPhase("idle");
        return;
      }
      if (!data.questions || data.questions.length === 0) {
        setFeedback({ kind: "error", text: "This quiz has no questions yet." });
        setPhase("idle");
        return;
      }
      setQuiz(data);
      setAnswers(new Array<number | null>(data.questions.length).fill(null));
      setCurrent(0);
      setResult(null);
      setPhase("playing");
    })();
  }

  function choose(index: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = index;
      return next;
    });
    setFeedback(null);
  }

  function submit() {
    if (!quiz) return;
    if (answers.some((a) => a === null)) {
      setFeedback({ kind: "error", text: "Answer every question before submitting." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await submitQuiz(quiz.slug, answers as number[]);
      if (res.ok) {
        const meta = res.meta as { correct?: number; total?: number } | undefined;
        setResult({
          correct: meta?.correct ?? 0,
          total: meta?.total ?? quiz.questions.length,
          coins: res.amount ?? 0,
          balance: res.balance,
        });
        setPhase("done");
      } else {
        setFeedback({ kind: "error", text: friendlyError(res.error) });
      }
    });
  }

  function playAgain() {
    if (!quiz) return;
    setAnswers(new Array<number | null>(quiz.questions.length).fill(null));
    setCurrent(0);
    setResult(null);
    setFeedback(null);
    setPhase("playing");
  }

  if (phase === "idle" || phase === "loading") {
    return (
      <div className="rounded-lg border border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          {description ?? `Answer ${title} to earn up to ${formatCoins(rewardAmount)}.`}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {formatCoins(rewardAmount)} reward · {maxAttempts} attempt
          {maxAttempts === 1 ? "" : "s"} per day
        </p>
        <Button className="mt-3" variant="default" onClick={startQuiz} disabled={phase === "loading"}>
          {phase === "loading" && <Loader2 className="animate-spin" aria-hidden />}
          {phase === "loading" ? "Loading quiz…" : "Start quiz"}
        </Button>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="rounded-lg border border-border bg-muted p-4" role="status">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-coin" aria-hidden />
          <p className="font-semibold">
            You scored {result.correct}/{result.total}
          </p>
        </div>
        <p className="mt-2 text-sm">
          {result.coins > 0 ? (
            <>
              Earned: <span className="font-semibold text-coin">+{formatCoins(result.coins)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              No AC added this round — the daily reward cap may already be reached.
            </span>
          )}
        </p>
        {typeof result.balance === "number" && (
          <p className="mt-1 text-sm text-muted-foreground">
            Balance: <span className="font-medium text-coin">{formatCoins(result.balance)}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={playAgain}>
            Try again
          </Button>
        </div>
        <div aria-live="polite" className="mt-2 text-sm">
          {feedback && <p className="text-destructive">{feedback.text}</p>}
        </div>
      </div>
    );
  }

  if (!quiz) return null;
  const question = quiz.questions[current];
  const isLast = current === quiz.questions.length - 1;
  const answeredCount = answers.filter((a) => a !== null).length;

  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium" aria-live="polite">
          Question {current + 1} of {quiz.questions.length}
        </p>
        <Badge variant="muted">{answeredCount}/{quiz.questions.length} answered</Badge>
      </div>

      <fieldset className="mt-3" key={question.id}>
        <legend className="text-sm font-semibold leading-snug">{question.question}</legend>
        <div className="mt-2 space-y-2">
          {question.options.map((option, index) => (
            <label
              key={index}
              className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/40 has-[:checked]:border-primary/60"
            >
              <input
                type="radio"
                name={`quiz-${quiz.id}-q${current}`}
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={answers[current] === index}
                onChange={() => choose(index)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite" className="mt-3 text-sm">
        {feedback && <p className="text-destructive">{feedback.text}</p>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCurrent((c) => Math.max(0, c - 1));
            setFeedback(null);
          }}
          disabled={current === 0}
        >
          <ChevronLeft aria-hidden /> Previous
        </Button>
        {isLast ? (
          <Button variant="coin" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? "Submitting…" : "Submit answers"}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setCurrent((c) => Math.min(quiz.questions.length - 1, c + 1));
              setFeedback(null);
            }}
          >
            Next <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
