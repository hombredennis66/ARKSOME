-- Independent task definitions and member completion reviews.
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 5000),
  reward_amount integer NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  starts_at timestamptz,
  deadline timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deadline IS NULL OR starts_at IS NULL OR deadline >= starts_at)
);

CREATE INDEX tasks_status_dates_idx ON public.tasks(status, starts_at, deadline);

CREATE TABLE public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 1000),
  reward_amount_snapshot integer NOT NULL CHECK (reward_amount_snapshot >= 0),
  CONSTRAINT task_submissions_task_user_key UNIQUE(task_id, user_id),
  CONSTRAINT task_submission_review_consistency CHECK (
    (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);

CREATE INDEX task_submissions_status_submitted_idx ON public.task_submissions(status, submitted_at DESC);
CREATE INDEX task_submissions_user_submitted_idx ON public.task_submissions(user_id, submitted_at DESC);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_task_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$function$;

REVOKE ALL ON FUNCTION public.is_task_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_task_admin() TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.tasks TO authenticated;
GRANT SELECT ON public.task_submissions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.task_submissions FROM anon, authenticated;

CREATE POLICY tasks_read_active_or_admin ON public.tasks
  FOR SELECT TO authenticated USING (
    status = 'active' OR public.is_task_admin()
    OR EXISTS (SELECT 1 FROM public.task_submissions s WHERE s.task_id = tasks.id AND s.user_id = auth.uid())
  );
CREATE POLICY tasks_admin_insert ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_task_admin() AND created_by = auth.uid());
CREATE POLICY tasks_admin_update ON public.tasks
  FOR UPDATE TO authenticated USING (public.is_task_admin()) WITH CHECK (public.is_task_admin());
CREATE POLICY task_submissions_read_own_or_admin ON public.task_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_task_admin());

-- The reward engine retains AC caps and ledger semantics. Task rewards use a
-- dedicated event type and the immutable completion id as the business key.
INSERT INTO public.reward_configs(key, label, amount, enabled, description)
VALUES ('task_completion', 'Task completion', 0, true, 'AC awarded after an administrator approves a task completion.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.submit_task_completion(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_submission public.task_submissions%rowtype;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND is_banned) THEN
    RAISE EXCEPTION 'account_unavailable';
  END IF;

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND status = 'active'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_unavailable'; END IF;
  IF v_task.starts_at IS NOT NULL AND v_task.starts_at > now() THEN RAISE EXCEPTION 'task_not_started'; END IF;
  IF v_task.deadline IS NOT NULL AND v_task.deadline < now() THEN RAISE EXCEPTION 'task_deadline_passed'; END IF;

  INSERT INTO public.task_submissions(task_id, user_id, reward_amount_snapshot)
  VALUES (v_task.id, v_user, v_task.reward_amount)
  ON CONFLICT (task_id, user_id) DO NOTHING
  RETURNING * INTO v_submission;

  IF NOT FOUND THEN RAISE EXCEPTION 'already_submitted'; END IF;
  RETURN jsonb_build_object('id', v_submission.id, 'status', v_submission.status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_task_completion(
  p_submission_id uuid,
  p_decision text,
  p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_submission public.task_submissions%rowtype;
  v_reward jsonb;
  v_note text := nullif(left(trim(coalesce(p_review_note, '')), 1000), '');
BEGIN
  IF v_admin IS NULL OR NOT public.is_task_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;

  SELECT * INTO v_submission
  FROM public.task_submissions
  WHERE id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  IF v_submission.status <> 'pending' THEN RAISE EXCEPTION 'submission_already_reviewed'; END IF;

  IF p_decision = 'approved' THEN
    v_reward := public.apply_reward(
      v_submission.user_id,
      'task_completion',
      v_submission.id::text,
      'task',
      jsonb_build_object('task_id', v_submission.task_id, 'submission_id', v_submission.id),
      v_submission.reward_amount_snapshot
    );
    IF NOT coalesce((v_reward ->> 'ok')::boolean, false) THEN
      RAISE EXCEPTION 'task_reward_failed:%', coalesce(v_reward ->> 'error', 'unknown');
    END IF;
  END IF;

  UPDATE public.task_submissions
  SET status = p_decision, reviewed_at = now(), reviewed_by = v_admin,
      review_note = v_note
  WHERE id = v_submission.id;

  PERFORM public.log_admin_action(
    'task_completion_' || p_decision,
    'task_submission',
    v_submission.id::text,
    jsonb_build_object('task_id', v_submission.task_id, 'user_id', v_submission.user_id, 'review_note', v_note)
  );

  RETURN jsonb_build_object('ok', true, 'status', p_decision, 'reward', v_reward);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_task_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_task_completion(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.review_task_completion(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_task_completion(uuid, text, text) TO authenticated;

-- Realtime is only a notification channel; table reads still obey RLS.
DO $function$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_submissions'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_submissions;
  END IF;
END;
$function$;
