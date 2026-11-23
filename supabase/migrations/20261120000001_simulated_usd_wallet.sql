-- Simulated USD rewards use the legacy USD wallet and ledger only.  This
-- migration intentionally leaves every AC table/function untouched.
-- Stable account references preserve financial ownership after Auth deletion.
CREATE TABLE public.account_records (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Preserve references for accounts that already exist.
INSERT INTO public.account_records (id)
SELECT id
FROM auth.users
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.account_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_records TO service_role;

-- Create the account reference before the existing signup trigger
-- creates wallets and other account records.
CREATE OR REPLACE FUNCTION public.create_account_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.account_records (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER create_account_record_before_signup
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_account_record();

-- Retain the account reference after Auth deletion.
CREATE OR REPLACE FUNCTION public.mark_account_record_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.account_records
  SET deleted_at = COALESCE(deleted_at, now())
  WHERE id = OLD.id;

  RETURN OLD;
END;
$function$;

CREATE TRIGGER mark_account_record_after_deletion
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.mark_account_record_deleted();

REVOKE ALL ON FUNCTION public.create_account_record() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_account_record_deleted() FROM PUBLIC, anon, authenticated;

-- Preserve USD wallet balances and ledger ownership after Auth deletion.
ALTER TABLE public.wallets
  DROP CONSTRAINT wallets_user_id_fkey,
  ADD CONSTRAINT wallets_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.account_records(id)
    ON DELETE RESTRICT;

ALTER TABLE public.coin_transactions
  DROP CONSTRAINT coin_transactions_user_id_fkey,
  ADD CONSTRAINT coin_transactions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.account_records(id)
    ON DELETE RESTRICT;

CREATE TABLE public.usd_reward_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,59}$'),
  category text NOT NULL CHECK (category IN ('advertisements', 'content_engagement', 'challenges', 'other')),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000),
  daily_limit integer CHECK (daily_limit IS NULL OR daily_limit >= 0),
  per_user_limit integer CHECK (per_user_limit IS NULL OR per_user_limit >= 0),
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.usd_reward_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.usd_reward_configs(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.account_records(id) ON DELETE RESTRICT,
  details text NOT NULL CHECK (char_length(btrim(details)) BETWEEN 1 AND 3000),
  activity_reference text NOT NULL CHECK (char_length(btrim(activity_reference)) BETWEEN 1 AND 300),
  reward_cents integer NOT NULL CHECK (reward_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usd_submission_review_consistency CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT usd_submission_reference_key UNIQUE(user_id, config_id, activity_reference)
);
CREATE INDEX usd_submissions_pending_idx ON public.usd_reward_submissions(status, created_at DESC);
CREATE INDEX usd_submissions_user_idx ON public.usd_reward_submissions(user_id, created_at DESC);
CREATE INDEX usd_submissions_limits_idx
  ON public.usd_reward_submissions(user_id, config_id, reviewed_at DESC)
  WHERE status = 'approved';

-- A request UUID makes administrator retries idempotent. Rows and the ledger
-- entry are committed together, so a retry returns the original result.
CREATE TABLE public.usd_admin_adjustments (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.account_records(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Link every new USD ledger row to its USD-only reference and make duplicate
-- ledger credits for the same approval/request impossible at the DB layer.
ALTER TABLE public.coin_transactions
  ADD COLUMN usd_submission_id uuid REFERENCES public.usd_reward_submissions(id) ON DELETE RESTRICT,
  ADD COLUMN usd_adjustment_request_id uuid REFERENCES public.usd_admin_adjustments(request_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX coin_transactions_usd_submission_key
  ON public.coin_transactions(usd_submission_id) WHERE usd_submission_id IS NOT NULL;
CREATE UNIQUE INDEX coin_transactions_usd_adjustment_key
  ON public.coin_transactions(usd_adjustment_request_id) WHERE usd_adjustment_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_usd_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$function$;

REVOKE ALL ON FUNCTION public.is_usd_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_usd_admin() TO authenticated;

ALTER TABLE public.usd_reward_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usd_reward_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usd_admin_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY usd_configs_read_enabled ON public.usd_reward_configs
  FOR SELECT TO authenticated USING (enabled OR public.is_usd_admin());
CREATE POLICY usd_submissions_read_own_or_admin ON public.usd_reward_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_usd_admin());
CREATE POLICY usd_admin_adjustments_read_admin ON public.usd_admin_adjustments
  FOR SELECT TO authenticated USING (public.is_usd_admin());
REVOKE ALL ON public.usd_reward_configs, public.usd_reward_submissions, public.usd_admin_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.usd_reward_configs, public.usd_reward_submissions, public.usd_admin_adjustments TO authenticated;
GRANT ALL ON public.usd_reward_configs, public.usd_reward_submissions, public.usd_admin_adjustments TO service_role;

CREATE OR REPLACE FUNCTION public.submit_usd_activity(
  p_config_id uuid, p_details text, p_activity_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_config public.usd_reward_configs%rowtype;
  v_submission uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND is_banned) THEN RAISE EXCEPTION 'account_unavailable'; END IF;
  IF p_details IS NULL OR char_length(btrim(p_details)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'invalid_details'; END IF;
  IF p_activity_reference IS NULL OR char_length(btrim(p_activity_reference)) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_reference'; END IF;
  SELECT * INTO v_config FROM public.usd_reward_configs WHERE id = p_config_id AND enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'activity_unavailable'; END IF;
  INSERT INTO public.usd_reward_submissions(config_id,user_id,details,activity_reference,reward_cents)
  VALUES (v_config.id,v_user,btrim(p_details),btrim(p_activity_reference),v_config.amount_cents)
  RETURNING id INTO v_submission;
  RETURN jsonb_build_object('ok',true,'submission_id',v_submission,'status','pending');
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_usd_activity(
  p_submission_id uuid, p_decision text, p_review_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_submission public.usd_reward_submissions%rowtype;
  v_config public.usd_reward_configs%rowtype;
  v_balance integer;
  v_tx uuid;
  v_count integer;
  v_utc_day_start timestamptz := date_trunc('day', timezone('UTC', now())) AT TIME ZONE 'UTC';
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_admin
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF p_review_note IS NOT NULL AND char_length(p_review_note) > 1000 THEN RAISE EXCEPTION 'invalid_review_note'; END IF;
  SELECT * INTO v_submission FROM public.usd_reward_submissions WHERE id=p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  IF v_submission.user_id = v_admin THEN RAISE EXCEPTION 'self_review_forbidden'; END IF;
  IF v_submission.status <> 'pending' THEN
    IF v_submission.status <> p_decision THEN RAISE EXCEPTION 'submission_already_reviewed'; END IF;
    IF v_submission.status = 'approved' THEN
      SELECT id, balance_after
      INTO v_tx, v_balance
      FROM public.coin_transactions
      WHERE usd_submission_id = v_submission.id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'approved_submission_ledger_missing';
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'status', 'approved',
        'amount_cents', v_submission.reward_cents,
        'balance', v_balance,
        'transaction_id', v_tx
      );
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'status','rejected');
  END IF;
  IF p_decision = 'approved' AND EXISTS (
    SELECT 1
    FROM public.account_records
    WHERE id = v_submission.user_id
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'account_deleted';
  END IF;
  IF p_decision = 'rejected' THEN
    UPDATE public.usd_reward_submissions
    SET status = 'rejected',
        reviewed_by = v_admin,
        reviewed_at = now(),
        review_note = nullif(btrim(p_review_note), '')
    WHERE id = p_submission_id;

    PERFORM public.log_admin_action(
      'usd_reward_rejected',
      'usd_reward_submission',
      p_submission_id::text,
      jsonb_build_object(
        'user_id', v_submission.user_id,
        'amount_cents', v_submission.reward_cents,
        'review_note', nullif(btrim(p_review_note), '')
      )
    );

    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;
  SELECT * INTO v_config FROM public.usd_reward_configs WHERE id=v_submission.config_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'activity_config_missing'; END IF;
  IF v_config.daily_limit IS NOT NULL THEN
    -- Daily caps follow UTC calendar days, matching the member check-in key.
    SELECT count(*) INTO v_count
    FROM public.usd_reward_submissions
    WHERE config_id = v_config.id
      AND user_id = v_submission.user_id
      AND status = 'approved'
      AND reviewed_at >= v_utc_day_start
      AND reviewed_at < v_utc_day_start + interval '1 day';
    IF v_count >= v_config.daily_limit THEN RAISE EXCEPTION 'daily_limit_reached'; END IF;
  END IF;
  IF v_config.per_user_limit IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.usd_reward_submissions WHERE config_id=v_config.id AND user_id=v_submission.user_id AND status='approved';
    IF v_count >= v_config.per_user_limit THEN RAISE EXCEPTION 'per_user_limit_reached'; END IF;
  END IF;
  INSERT INTO public.wallets(user_id) VALUES(v_submission.user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id=v_submission.user_id FOR UPDATE;
  IF v_submission.reward_cents > 2147483647 - v_balance THEN RAISE EXCEPTION 'balance_overflow'; END IF;
  v_balance := v_balance + v_submission.reward_cents;
  INSERT INTO public.coin_transactions(user_id,type,amount,balance_after,reason,source,usd_submission_id)
  VALUES(v_submission.user_id,'credit',v_submission.reward_cents,v_balance,v_config.label,'usd_activity',v_submission.id) RETURNING id INTO v_tx;
  UPDATE public.wallets SET balance=v_balance,updated_at=now() WHERE user_id=v_submission.user_id;
  UPDATE public.usd_reward_submissions SET status='approved',reviewed_by=v_admin,reviewed_at=now(),review_note=nullif(btrim(p_review_note),'') WHERE id=p_submission_id;
  PERFORM public.log_admin_action('usd_reward_approved','usd_reward_submission',p_submission_id::text,jsonb_build_object('user_id',v_submission.user_id,'amount_cents',v_submission.reward_cents,'transaction_id',v_tx));
  RETURN jsonb_build_object('ok',true,'status','approved','amount_cents',v_submission.reward_cents,'balance',v_balance,'transaction_id',v_tx);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_usd_balance(
  p_user_id uuid, p_amount_cents integer, p_reason text, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_balance integer;
  v_tx uuid;
  v_existing public.usd_admin_adjustments%rowtype;
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_admin
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF p_user_id IS NULL OR p_amount_cents IS NULL OR p_amount_cents=0 OR p_amount_cents='-2147483648'::integer OR p_request_id IS NULL THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'invalid_reason'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'user_not_found'; END IF;
  INSERT INTO public.usd_admin_adjustments(request_id,user_id,amount_cents,reason,balance_after,created_by)
  VALUES(p_request_id,p_user_id,p_amount_cents,btrim(p_reason),0,v_admin) ON CONFLICT(request_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.usd_admin_adjustments WHERE request_id=p_request_id;
    IF v_existing.user_id<>p_user_id OR v_existing.amount_cents<>p_amount_cents OR v_existing.reason<>btrim(p_reason) OR v_existing.created_by IS DISTINCT FROM v_admin THEN RAISE EXCEPTION 'request_id_conflict'; END IF;
    SELECT id, balance_after
    INTO v_tx, v_balance
    FROM public.coin_transactions
    WHERE usd_adjustment_request_id = p_request_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'adjustment_ledger_missing';
    END IF;

    IF v_balance <> v_existing.balance_after THEN
      RAISE EXCEPTION 'adjustment_balance_mismatch';
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'balance', v_existing.balance_after,
      'transaction_id', v_tx
    );
  END IF;
  INSERT INTO public.wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id=p_user_id FOR UPDATE;
  IF p_amount_cents < 0 AND v_balance < abs(p_amount_cents) THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  IF p_amount_cents > 0 AND p_amount_cents > 2147483647-v_balance THEN RAISE EXCEPTION 'balance_overflow'; END IF;
  v_balance := v_balance+p_amount_cents;
  INSERT INTO public.coin_transactions(user_id,type,amount,balance_after,reason,source,usd_adjustment_request_id)
  VALUES(p_user_id,CASE WHEN p_amount_cents>0 THEN 'credit'::public.transaction_type ELSE 'debit'::public.transaction_type END,abs(p_amount_cents),v_balance,btrim(p_reason),'admin_usd',p_request_id);
  UPDATE public.wallets SET balance=v_balance,updated_at=now() WHERE user_id=p_user_id;
  UPDATE public.usd_admin_adjustments SET balance_after=v_balance WHERE request_id=p_request_id;
  PERFORM public.log_admin_action('usd_balance_adjustment','wallet',p_user_id::text,jsonb_build_object('amount_cents',p_amount_cents,'reason',btrim(p_reason),'request_id',p_request_id));
  RETURN jsonb_build_object('ok',true,'duplicate',false,'balance',v_balance);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_usd_activity(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_usd_activity(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_usd_activity(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_usd_activity(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_adjust_usd_balance(uuid,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_usd_balance(uuid,integer,text,uuid) TO authenticated;
