import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatCoins } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { CheckinCard } from "@/components/dashboard/checkin-card";
import { QuizPlayer } from "@/components/dashboard/quiz-player";
import type { Activity, Quiz } from "@/lib/database.types";

export const dynamic = "force-dynamic";

/** Columns the list needs — the player fetches questions itself. */
type QuizListItem = Pick<
  Quiz,
  "id" | "slug" | "title" | "description" | "reward_amount" | "max_attempts_per_day"
>;

export default async function ActivitiesPage() {
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;

  const user = await requireUser("/activities");
  const today = new Date().toISOString().slice(0, 10);

  const [checkinRes, latestCheckinRes, quizzesRes, activitiesRes] = await Promise.all([
    supabase
      .from("daily_checkins")
      .select("checkin_date, streak_count")
      .eq("user_id", user.id)
      .eq("checkin_date", today)
      .maybeSingle(),
    supabase
      .from("daily_checkins")
      .select("streak_count")
      .eq("user_id", user.id)
      .order("checkin_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("quizzes")
      .select("id, slug, title, description, reward_amount, max_attempts_per_day")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("activities")
      .select("*")
      .eq("enabled", true)
      .order("position", { ascending: true }),
  ]);

  const alreadyClaimed = Boolean(checkinRes.data);
  const streak = latestCheckinRes.data?.streak_count ?? 0;
  const quizzes: QuizListItem[] = quizzesRes.data ?? [];
  const activities: Activity[] = activitiesRes.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Activities</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Every reward here is optional and capped daily — do what you enjoy and the AC follows.
          Amounts reflect the current reward configuration.
        </p>
      </div>

      {/* Daily check-in */}
      <section aria-labelledby="checkin-heading">
        <h2 id="checkin-heading" className="mb-3 text-lg font-semibold">
          Daily check-in
        </h2>
        <CheckinCard alreadyClaimed={alreadyClaimed} initialStreak={streak} />
      </section>

      {/* Quizzes */}
      <section aria-labelledby="quizzes-heading">
        <h2 id="quizzes-heading" className="mb-3 text-lg font-semibold">
          Quizzes
        </h2>
        {quizzes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No quizzes are running right now — check back soon.
          </div>
        ) : (
          <ul className="space-y-4">
            {quizzes.map((quiz) => (
              <li key={quiz.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">{quiz.title}</h3>
                    {quiz.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatCoins(quiz.reward_amount)} reward · {quiz.max_attempts_per_day} attempt
                      {quiz.max_attempts_per_day === 1 ? "" : "s"} per day
                    </p>
                  </div>
                  <Badge variant="coin">{formatCoins(quiz.reward_amount)}</Badge>
                </div>
                <div className="mt-4">
                  <QuizPlayer
                    slug={quiz.slug}
                    title={quiz.title}
                    description={quiz.description}
                    rewardAmount={quiz.reward_amount}
                    maxAttempts={quiz.max_attempts_per_day}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity catalogue */}
      <section aria-labelledby="all-activities-heading">
        <h2 id="all-activities-heading" className="mb-3 text-lg font-semibold">
          All activities
        </h2>
        {activities.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No activities are enabled right now — check back soon.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {activities.map((activity) => (
              <li
                key={activity.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold">{activity.title}</h3>
                  <Badge variant="coin" className="shrink-0">
                    {activity.reward_amount > 0 ? formatCoins(activity.reward_amount) : "Varies"}
                  </Badge>
                </div>
                {activity.description && (
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                )}
                <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
                  {activity.activity_type.replace(/_/g, " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          Rewards are optional and capped per day. Reaching a cap never affects your balance — it
          only stops additional AC from being added until the next day.{" "}
          <Link href="/wallet" className="font-medium text-primary hover:underline">
            See your wallet
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
