import { ActivitiesPanel } from "@/components/admin/activities-panel";
import { QuizzesPanel, type AdminQuizItem } from "@/components/admin/quizzes-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Quiz } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const QUIZ_LIST_SELECT =
  "id, slug, title, description, reward_amount, max_attempts_per_day, is_active, questions, created_at";

type QuizWithAnswers = Quiz & { answers?: unknown };

export default async function AdminActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();
  const { edit } = await searchParams;
  const editId = typeof edit === "string" ? edit : undefined;

  const supabase = await createClient();
  const service = getServiceClient();
  const serviceReady = Boolean(service);

  let activities: Activity[] = [];
  let quizItems: AdminQuizItem[] = [];
  let editQuiz: AdminQuizItem | null = null;
  let loadError: string | null = null;

  if (supabase) {
    const [activitiesRes, quizzesRes] = await Promise.all([
      supabase.from("activities").select("*").order("position", { ascending: true }).limit(100),
      supabase.from("quizzes").select(QUIZ_LIST_SELECT).order("created_at", { ascending: false }).limit(50),
    ]);
    if (activitiesRes.error) loadError = activitiesRes.error.message;
    else if (quizzesRes.error) loadError = quizzesRes.error.message;

    activities = activitiesRes.data ?? [];
    quizItems = (quizzesRes.data ?? []).map((quiz) => ({ ...quiz, answersJson: "" }));

    // Editing a quiz requires the answer key, which session clients can never
    // read (column-level grant). Load it with the service-role client only
    // when an edit was requested.
    if (editId && service) {
      const { data, error } = await service
        .from("quizzes")
        .select("*")
        .eq("id", editId)
        .maybeSingle();
      if (error) {
        loadError = error.message;
      } else if (data) {
        const row = data as QuizWithAnswers;
        editQuiz = {
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          reward_amount: row.reward_amount,
          max_attempts_per_day: row.max_attempts_per_day,
          is_active: row.is_active,
          questions: row.questions,
          created_at: row.created_at,
          answersJson: JSON.stringify(row.answers ?? [], null, 2),
        };
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage earning activities and quizzes. Reward values written here are validated
          server-side and caps stay enforced by the database.
        </p>
      </div>

      {!supabase && (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Activity and quiz management becomes available once connected.</AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Failed to load activities</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {editId && service && !editQuiz && !loadError && (
        <Alert variant="info">
          <AlertTitle>Quiz not found</AlertTitle>
          <AlertDescription>The quiz being edited no longer exists.</AlertDescription>
        </Alert>
      )}

      <ActivitiesPanel activities={activities} serviceReady={serviceReady} />

      <QuizzesPanel quizzes={quizItems} editQuiz={editQuiz} serviceReady={serviceReady} />
    </div>
  );
}
