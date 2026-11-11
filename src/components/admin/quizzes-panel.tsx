"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { adminSaveQuiz, type QuizInput } from "@/lib/actions/admin";
import type { QuizQuestion } from "@/lib/database.types";
import { formatCoins } from "@/lib/utils";

export type AdminQuizItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  reward_amount: number;
  max_attempts_per_day: number;
  is_active: boolean;
  questions: QuizQuestion[];
  created_at: string;
  /** Pretty-printed answer key — only populated for the quiz being edited
   * (loaded server-side through the service-role client). */
  answersJson: string;
};

const EMPTY_QUESTIONS = JSON.stringify(
  [{ id: "q1", question: "Your question?", options: ["Option A", "Option B"] }],
  null,
  2,
);

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

/**
 * Quizzes manager. All reads/writes of the `answers` column go through the
 * service-role client (the column is not granted to authenticated users), so
 * editing is disabled until SUPABASE_SERVICE_ROLE_KEY is configured.
 */
export function QuizzesPanel({
  quizzes,
  editQuiz,
  serviceReady,
}: {
  quizzes: AdminQuizItem[];
  editQuiz: AdminQuizItem | null;
  serviceReady: boolean;
}) {
  const router = useRouter();
  const { run, pending, feedback } = useAdminAction();
  const [creating, setCreating] = useState(false);

  const editing = editQuiz;
  const open = creating || editing !== null;

  function closeForm() {
    setCreating(false);
    router.push("/admin/activities");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: QuizInput = {
      slug: String(formData.get("slug") ?? ""),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "").trim() || null,
      reward_amount: Number(formData.get("reward_amount")),
      max_attempts_per_day: Number(formData.get("max_attempts_per_day")),
      is_active: formData.get("is_active") === "on",
      questionsJson: String(formData.get("questions") ?? ""),
      answersJson: String(formData.get("answers") ?? ""),
    };
    const result = await run(() => adminSaveQuiz(editing ? editing.id : null, payload));
    if (result.ok) {
      form.reset();
      setCreating(false);
      router.push("/admin/activities");
    }
  }

  const values = editing ?? null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Quizzes</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Graded in the database — members never receive the answer key.
          </p>
        </div>
        <Button
          size="sm"
          disabled={!serviceReady || pending || open}
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="size-4" />
          New quiz
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!serviceReady && (
          <Alert variant="warning">
            <AlertDescription>
              <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is not set. Quiz answers
              are stored in a column that is never granted to session clients, so quiz editing is
              disabled until the service key is configured.
            </AlertDescription>
          </Alert>
        )}

        {quizzes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No quizzes yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {quizzes.map((quiz) => (
              <li key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {quiz.title}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{quiz.slug}</code>
                    <Badge variant={quiz.is_active ? "success" : "muted"}>
                      {quiz.is_active ? "active" : "inactive"}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} · pays{" "}
                    {formatCoins(quiz.reward_amount)} per correct answer · {quiz.max_attempts_per_day}{" "}
                    attempt{quiz.max_attempts_per_day === 1 ? "" : "s"}/day
                  </p>
                </div>
                <Link
                  href={`/admin/activities?edit=${quiz.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  hidden={!serviceReady}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}

        {open && (
          <form
            key={values?.id ?? "new-quiz"}
            onSubmit={handleSubmit}
            className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 md:grid-cols-2"
          >
            <div className="flex items-center justify-between md:col-span-2">
              <p className="text-sm font-semibold">{values ? `Edit “${values.title}”` : "New quiz"}</p>
              <Button size="icon" variant="ghost" type="button" onClick={closeForm} aria-label="Close form">
                <X className="size-4" />
              </Button>
            </div>

            <Field label="Title" htmlFor="quiz-title">
              <Input id="quiz-title" name="title" required maxLength={200} defaultValue={values?.title ?? ""} disabled={pending} />
            </Field>
            <Field label="Slug" htmlFor="quiz-slug" hint="Auto-derived from the title if you leave it blank.">
              <Input id="quiz-slug" name="slug" defaultValue={values?.slug ?? ""} disabled={pending} placeholder="my-quiz" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description" htmlFor="quiz-description">
                <Textarea id="quiz-description" name="description" rows={2} maxLength={1000} defaultValue={values?.description ?? ""} disabled={pending} />
              </Field>
            </div>
            <Field label="Reward per correct answer (AC)" htmlFor="quiz-reward">
              <Input id="quiz-reward" name="reward_amount" type="number" min={0} step={1} required defaultValue={values?.reward_amount ?? 0} disabled={pending} />
            </Field>
            <Field label="Max attempts per day" htmlFor="quiz-attempts" hint="Anti-farming cap enforced by the database.">
              <Input id="quiz-attempts" name="max_attempts_per_day" type="number" min={1} max={100} step={1} required defaultValue={values?.max_attempts_per_day ?? 1} disabled={pending} />
            </Field>

            <div className="md:col-span-2">
              <Field
                label="Questions (JSON)"
                htmlFor="quiz-questions"
                hint='Array of { "id", "question", "options": [...] } — 2–8 options each.'
              >
                <Textarea
                  id="quiz-questions"
                  name="questions"
                  rows={8}
                  required
                  spellCheck={false}
                  className="font-mono text-xs"
                  defaultValue={
                    values
                      ? JSON.stringify(values.questions, null, 2)
                      : EMPTY_QUESTIONS
                  }
                  disabled={pending || !serviceReady}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field
                label="Answers (JSON)"
                htmlFor="quiz-answers"
                hint="One option index per question, e.g. [0, 2, 1]. Grading happens in the database; this key is never sent to members."
              >
                <Textarea
                  id="quiz-answers"
                  name="answers"
                  rows={4}
                  required
                  spellCheck={false}
                  className="font-mono text-xs"
                  defaultValue={values?.answersJson || "[]"}
                  disabled={pending || !serviceReady}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="is_active" defaultChecked={values?.is_active ?? true} disabled={pending} className="size-4 rounded border-input" />
                Active (visible to members)
              </label>
              <Button type="submit" size="sm" disabled={pending || !serviceReady}>
                <Check className="size-4" />
                {pending ? "Saving…" : values ? "Save quiz" : "Create quiz"}
              </Button>
            </div>
            <div className="md:col-span-2">
              <ActionFeedback feedback={feedback} />
            </div>
          </form>
        )}

        {!open && <ActionFeedback feedback={feedback} />}
      </CardContent>
    </Card>
  );
}
