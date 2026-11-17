-- Separate legacy ARKSOME Coin (AC) from the simulated USD wallet.

CREATE TABLE public.ac_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ac_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'app',
 reward_event_id uuid REFERENCES public.reward_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ac_transactions_user_idx
  ON public.ac_transactions (user_id, created_at DESC);

CREATE INDEX ac_transactions_reward_event_idx
  ON public.ac_transactions (reward_event_id);


ALTER TABLE public.ac_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ac_wallets_select
  ON public.ac_wallets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY ac_transactions_select
  ON public.ac_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL PRIVILEGES
  ON TABLE public.ac_wallets, public.ac_transactions
  FROM anon, authenticated;

GRANT SELECT
  ON TABLE public.ac_wallets, public.ac_transactions
  TO authenticated;


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username text;
  v_ref_code text;
  v_referrer uuid;
  v_display text;
BEGIN
  v_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(new.email, new.id::text), '@', 1)
  );

  v_display := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    v_username
  );

  v_ref_code := upper(
    substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8)
  );

  INSERT INTO public.profiles (id, username, display_name, referral_code)
  VALUES (new.id, v_username, v_display, v_ref_code)
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE username = v_username AND id <> new.id
  ) THEN
    UPDATE public.profiles
    SET username = v_username || '_' || substr(new.id::text, 1, 6)
    WHERE id = new.id;
  END IF;

  INSERT INTO public.wallets (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.ac_wallets (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'member')
  ON CONFLICT DO NOTHING;

  v_ref_code := nullif(new.raw_user_meta_data ->> 'referral_code', '');

  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer
    FROM public.profiles
    WHERE referral_code = upper(v_ref_code);

    IF v_referrer IS NOT NULL AND v_referrer <> new.id THEN
      INSERT INTO public.referrals (referrer_id, referred_id, status)
      VALUES (v_referrer, new.id, 'pending')
      ON CONFLICT (referred_id) DO NOTHING;

      PERFORM public.apply_reward(
        v_referrer,
        'referral_signup',
        new.id::text,
        'referral',
        jsonb_build_object('referred_user', new.id)
      );
    END IF;
  END IF;

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ac_balance()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (
      SELECT balance
      FROM public.ac_wallets
      WHERE user_id = auth.uid()
    ),
    0
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_ac_balance_for(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (
      SELECT balance
      FROM public.ac_wallets
      WHERE user_id = p_user_id
    ),
    0
  );
$function$;
REVOKE ALL ON FUNCTION public.get_ac_balance()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_ac_balance_for(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_ac_balance()
  TO authenticated;


-- Initialize AC wallets for users who already exist.
INSERT INTO public.ac_wallets (user_id)
SELECT id
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_reward(
  p_user_id uuid,
  p_event_type text,
  p_business_key text,
  p_source text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_amount_override integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_config public.reward_configs%rowtype;
  v_balance integer;
  v_amount integer;
  v_count integer;
  v_event_id uuid;
  v_existing public.reward_events%rowtype;
  v_idem text;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user');
  END IF;

  -- Ensure the AC wallet exists and serialize reward processing per user.
  INSERT INTO public.ac_wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance
  INTO v_balance
  FROM public.ac_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_idem := p_user_id::text || ':' || p_event_type || ':' || p_business_key;

  SELECT *
  INTO v_existing
  FROM public.reward_events
  WHERE idempotency_key = v_idem;

  IF FOUND THEN
    IF v_existing.status = 'granted' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'amount', v_existing.amount,
        'balance', v_balance,
        'event_id', v_existing.id
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'already_rejected',
      'reason', v_existing.metadata ->> 'reason'
    );
  END IF;

  SELECT *
  INTO v_config
  FROM public.reward_configs
  WHERE key = p_event_type;

  IF NOT FOUND OR NOT v_config.enabled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_available');
  END IF;

  v_amount := coalesce(p_amount_override, v_config.amount);

  IF v_amount IS NULL OR v_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- Daily cap per event type.
  IF v_config.daily_limit IS NOT NULL THEN
    SELECT count(*)
    INTO v_count
    FROM public.reward_events
    WHERE user_id = p_user_id
      AND event_type = p_event_type
      AND status = 'granted'
      AND created_at >= date_trunc('day', now());

    IF v_count >= v_config.daily_limit THEN
      INSERT INTO public.reward_events (
        user_id, event_type, business_key, idempotency_key,
        amount, status, source, metadata
      )
      VALUES (
        p_user_id, p_event_type, p_business_key, v_idem,
        0, 'rejected', p_source,
        v_meta || jsonb_build_object('reason', 'daily_limit_reached')
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      RETURN jsonb_build_object(
        'ok', false,
        'error', 'daily_limit_reached',
        'limit', v_config.daily_limit
      );
    END IF;
  END IF;

  -- Lifetime cap per user per event type.
  IF v_config.per_user_limit IS NOT NULL THEN
    SELECT count(*)
    INTO v_count
    FROM public.reward_events
    WHERE user_id = p_user_id
      AND event_type = p_event_type
      AND status = 'granted';

    IF v_count >= v_config.per_user_limit THEN
      INSERT INTO public.reward_events (
        user_id, event_type, business_key, idempotency_key,
        amount, status, source, metadata
      )
      VALUES (
        p_user_id, p_event_type, p_business_key, v_idem,
        0, 'rejected', p_source,
        v_meta || jsonb_build_object('reason', 'per_user_limit_reached')
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      RETURN jsonb_build_object(
        'ok', false,
        'error', 'per_user_limit_reached',
        'limit', v_config.per_user_limit
      );
    END IF;
  END IF;

  IF v_amount = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', false,
      'amount', 0,
      'balance', v_balance
    );
  END IF;

  INSERT INTO public.reward_events (
    user_id, event_type, business_key, idempotency_key,
    amount, status, source, metadata
  )
  VALUES (
    p_user_id, p_event_type, p_business_key, v_idem,
    v_amount, 'granted', p_source, v_meta
  )
  RETURNING id INTO v_event_id;

  v_balance := v_balance + v_amount;

  INSERT INTO public.ac_transactions (
    user_id, type, amount, balance_after,
    reason, source, reward_event_id
  )
  VALUES (
    p_user_id, 'credit', v_amount, v_balance,
    v_config.label, p_source, v_event_id
  );

  UPDATE public.ac_wallets
  SET balance = v_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'amount', v_amount,
    'balance', v_balance,
    'event_id', v_event_id,
    'label', v_config.label
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id uuid,
  p_amount integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance integer;
  v_event uuid;
  v_business_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_user_id IS NULL
     OR p_amount IS NULL
     OR p_amount = 0
     OR p_amount = '-2147483648'::integer THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;

  INSERT INTO public.ac_wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance
  INTO v_balance
  FROM public.ac_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF p_amount < 0 AND v_balance + p_amount < 0 THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_business_key := gen_random_uuid()::text;

  INSERT INTO public.reward_events (
    user_id, event_type, business_key, idempotency_key,
    amount, status, source, metadata
  )
  VALUES (
    p_user_id,
    'admin_adjustment',
    v_business_key,
    p_user_id::text || ':admin_adjustment:' || v_business_key,
    abs(p_amount),
    'granted',
    'admin',
    jsonb_build_object(
      'reason', p_reason,
      'actor', auth.uid(),
      'direction', CASE WHEN p_amount > 0 THEN 'credit' ELSE 'debit' END
    )
  )
  RETURNING id INTO v_event;

  v_balance := v_balance + p_amount;

  INSERT INTO public.ac_transactions (
    user_id, type, amount, balance_after,
    reason, source, reward_event_id
  )
  VALUES (
    p_user_id,
    CASE WHEN p_amount > 0 THEN 'credit'::public.transaction_type
         ELSE 'debit'::public.transaction_type
    END,
    abs(p_amount),
    v_balance,
    p_reason,
    'admin',
    v_event
  );

  UPDATE public.ac_wallets
  SET balance = v_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  PERFORM public.log_admin_action(
    'balance_adjustment',
    'ac_wallet',
    p_user_id::text,
    jsonb_build_object('amount', p_amount, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_balance
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_quiz_slug text,
  p_answers jsonb,
  p_source text DEFAULT 'quiz'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_answers jsonb;
  v_correct integer := 0;
  v_total integer;
  v_attempt uuid;
  v_today integer;
  v_cfg public.reward_configs%rowtype;
  v_amount integer;
  v_award jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT *
  INTO v_quiz
  FROM public.quizzes
  WHERE slug = p_quiz_slug AND is_active;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quiz_not_found');
  END IF;

  v_answers := v_quiz.answers;
  v_total := jsonb_array_length(v_quiz.questions);

  IF p_answers IS NULL
     OR jsonb_typeof(p_answers) <> 'array'
     OR jsonb_array_length(p_answers) <> v_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_submission');
  END IF;

  -- Attempts per day (anti-farming).
  SELECT count(*)
  INTO v_today
  FROM public.quiz_attempts
  WHERE user_id = v_user
    AND quiz_id = v_quiz.id
    AND created_at >= date_trunc('day', now());

  IF v_today >= v_quiz.max_attempts_per_day THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'attempts_exhausted',
      'limit', v_quiz.max_attempts_per_day
    );
  END IF;

  FOR i IN 0 .. v_total - 1 LOOP
    IF (p_answers ->> i)::int = (v_answers ->> i)::int THEN
      v_correct := v_correct + 1;
    END IF;
  END LOOP;

  INSERT INTO public.quiz_attempts (
    user_id, quiz_id, score, total, rewarded
  )
  VALUES (
    v_user, v_quiz.id, v_correct, v_total, v_correct > 0
  )
  RETURNING id INTO v_attempt;

  IF v_correct > 0 THEN
    SELECT *
    INTO v_cfg
    FROM public.reward_configs
    WHERE key = 'quiz_correct';

    v_amount := coalesce(v_cfg.amount, 0) * v_correct;

    IF v_amount > 0 THEN
      v_award := public.apply_reward(
        v_user,
        'quiz_correct',
        v_quiz.slug || ':' || v_attempt::text,
        p_source,
        jsonb_build_object(
          'quiz_slug', v_quiz.slug,
          'score', v_correct,
          'total', v_total
        ),
        v_amount
      );
    ELSE
      v_award := jsonb_build_object(
        'ok', true,
        'amount', 0,
        'balance', public.get_ac_balance_for(v_user)
      );
    END IF;
  ELSE
    v_award := jsonb_build_object(
      'ok', true,
      'amount', 0,
      'balance', public.get_ac_balance_for(v_user)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'attempt_id', v_attempt,
    'correct', v_correct,
    'total', v_total,
    'award', v_award
  );
END;
$function$;

REVOKE ALL PRIVILEGES
  ON TABLE public.ac_wallets, public.ac_transactions
  FROM PUBLIC;

REVOKE ALL ON FUNCTION public.apply_reward(
  uuid, text, text, text, jsonb, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_reward(
  uuid, text, text, text, jsonb, integer
) TO service_role;

REVOKE ALL ON FUNCTION public.claim_reward(
  text, text, text, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_reward(
  text, text, text, jsonb
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_adjust_balance(
  uuid, integer, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(
  uuid, integer, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_quiz_attempt(
  text, jsonb, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(
  text, jsonb, text
) TO authenticated, service_role;
