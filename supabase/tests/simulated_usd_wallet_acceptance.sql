-- Run against a disposable Supabase database after applying all migrations.
-- This transaction rolls back all test users and ledger rows.
BEGIN;

DO $acceptance$
DECLARE
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_deleted_member uuid := gen_random_uuid();
  v_daily_member uuid := gen_random_uuid();
  v_user uuid;
  v_config_id uuid := gen_random_uuid();
  v_daily_config_id uuid := gen_random_uuid();
  v_submission_id uuid;
  v_fixture_submission_id uuid := gen_random_uuid();
  v_adjustment_id uuid := gen_random_uuid();
  v_result jsonb;
  v_duplicate_result jsonb;
  v_balance integer;
  v_count integer;
  v_utc_day_start timestamptz;
  v_fixture_reviewed_at timestamptz;
  v_utc_hour integer;

BEGIN
  -- Signup triggers create account records, profiles, and both wallets.
  FOREACH v_user IN ARRAY ARRAY[v_admin, v_member, v_deleted_member, v_daily_member]
  LOOP
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_user, 'authenticated', 'authenticated', v_user::text || '@example.test',
      'test-password-hash', '{}'::jsonb, '{}'::jsonb, now(), now()
    );
  END LOOP;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (v_admin, 'admin');

  INSERT INTO public.usd_reward_configs(
    id, key, category, label, amount_cents, enabled, created_by, updated_by
  ) VALUES (
    v_config_id, 'usd_acceptance_idempotency', 'other', 'USD acceptance reward',
    250, true, v_admin, v_admin
  );

  -- Approve once, then retry the same approval and verify one credit/ledger row.
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member)::text, true);
  v_result := public.submit_usd_activity(v_config_id, 'Acceptance test completion', 'idempotency-ref');
  v_submission_id := (v_result ->> 'submission_id')::uuid;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin)::text, true);
  v_result := public.review_usd_activity(v_submission_id, 'approved', '');
  v_duplicate_result := public.review_usd_activity(v_submission_id, 'approved', '');

  IF coalesce((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'approval_idempotency_first_approval_failed';
  END IF;
  IF coalesce((v_duplicate_result ->> 'duplicate')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'approval_idempotency_retry_not_duplicate';
  END IF;
  IF v_duplicate_result ->> 'transaction_id' IS DISTINCT FROM v_result ->> 'transaction_id' THEN
    RAISE EXCEPTION 'approval_idempotency_retry_transaction_mismatch';
  END IF;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_member;
  SELECT count(*) INTO v_count FROM public.coin_transactions WHERE usd_submission_id = v_submission_id;
  IF v_balance <> 250 OR v_count <> 1 THEN
    RAISE EXCEPTION 'approval_idempotency_balance_or_ledger_mismatch';
  END IF;
  RAISE NOTICE 'PASS: duplicate approval credits once and returns its ledger result';

  INSERT INTO public.usd_reward_configs(
    id, key, category, label, amount_cents, daily_limit, enabled, created_by, updated_by
  ) VALUES (
    v_daily_config_id, 'usd_acceptance_utc_limit', 'other', 'UTC daily-limit test',
    75, 1, true, v_admin, v_admin
  );

  -- Create an auditable pending submission and financial history before Auth deletion.
  PERFORM set_config('request.jwt.claim.sub', v_deleted_member::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_deleted_member)::text, true);
  v_result := public.submit_usd_activity(v_config_id, 'Retained pending submission', 'deleted-account-ref');
  v_submission_id := (v_result ->> 'submission_id')::uuid;

  UPDATE public.wallets SET balance = 600 WHERE user_id = v_deleted_member;
  INSERT INTO public.coin_transactions(user_id, type, amount, balance_after, reason, source)
  VALUES (v_deleted_member, 'credit', 600, 600, 'Pre-deletion USD history', 'acceptance_history');

  INSERT INTO public.usd_admin_adjustments(
    request_id, user_id, amount_cents, reason, balance_after, created_by
  ) VALUES (
    v_adjustment_id, v_deleted_member, 300, 'Acceptance adjustment', 900, v_admin
  );
  UPDATE public.wallets SET balance = 900 WHERE user_id = v_deleted_member;
  INSERT INTO public.coin_transactions(
    user_id, type, amount, balance_after, reason, source, usd_adjustment_request_id
  ) VALUES (
    v_deleted_member, 'credit', 300, 900, 'Acceptance adjustment', 'admin_usd', v_adjustment_id
  );

  DELETE FROM auth.users WHERE id = v_deleted_member;

  IF NOT EXISTS (
    SELECT 1 FROM public.account_records
    WHERE id = v_deleted_member AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'account_deletion_record_not_marked';
  END IF;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_deleted_member;
  SELECT count(*) INTO v_count FROM public.coin_transactions WHERE user_id = v_deleted_member;
  IF v_balance <> 900 OR v_count <> 2 THEN
    RAISE EXCEPTION 'account_deletion_wallet_or_ledger_not_retained';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usd_admin_adjustments WHERE request_id = v_adjustment_id)
     OR NOT EXISTS (SELECT 1 FROM public.usd_reward_submissions WHERE id = v_submission_id AND status = 'pending') THEN
    RAISE EXCEPTION 'account_deletion_financial_records_not_retained';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin)::text, true);
  BEGIN
    PERFORM public.review_usd_activity(v_submission_id, 'approved', '');
    RAISE EXCEPTION 'deleted_account_approval_was_not_blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'account_deleted' THEN RAISE; END IF;
  END;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_deleted_member;
  SELECT count(*) INTO v_count FROM public.coin_transactions WHERE usd_submission_id = v_submission_id;
  IF v_balance <> 900 OR v_count <> 0 OR NOT EXISTS (
    SELECT 1 FROM public.usd_reward_submissions WHERE id = v_submission_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'deleted_account_approval_changed_financial_history';
  END IF;
  RAISE NOTICE 'PASS: Auth deletion retains wallet, adjustments, ledger, and pending submission; approval is blocked';

  -- Put an approved event on the UTC side of the Kiritimati day boundary that
  -- differs from local date_trunc('day', now()). The test adapts to run time.
  v_utc_day_start := date_trunc('day', timezone('UTC', now())) AT TIME ZONE 'UTC';
  v_utc_hour := extract(hour FROM timezone('UTC', now()))::integer;
  IF v_utc_hour >= 11 THEN
    v_fixture_reviewed_at := v_utc_day_start + interval '1 hour';
  ELSIF v_utc_hour >= 10 THEN
    v_fixture_reviewed_at := v_utc_day_start + (now() - v_utc_day_start) / 2.0;
  ELSE
    v_fixture_reviewed_at := v_utc_day_start - interval '12 hours';
  END IF;

  UPDATE public.wallets SET balance = 50 WHERE user_id = v_daily_member;
  INSERT INTO public.usd_reward_submissions(
    id, config_id, user_id, details, activity_reference, reward_cents,
    status, reviewed_by, reviewed_at
  ) VALUES (
    v_fixture_submission_id, v_daily_config_id, v_daily_member,
    'UTC daily-limit fixture', 'utc-fixture-ref', 50,
    'approved', v_admin, v_fixture_reviewed_at
  );
  INSERT INTO public.coin_transactions(
    user_id, type, amount, balance_after, reason, source, usd_submission_id
  ) VALUES (
    v_daily_member, 'credit', 50, 50, 'UTC daily-limit fixture', 'usd_activity', v_fixture_submission_id
  );

  PERFORM set_config('request.jwt.claim.sub', v_daily_member::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_daily_member)::text, true);
  v_result := public.submit_usd_activity(v_daily_config_id, 'UTC boundary completion', 'utc-new-ref');
  v_submission_id := (v_result ->> 'submission_id')::uuid;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin)::text, true);
  PERFORM set_config('TimeZone', 'Pacific/Kiritimati', true);

  IF v_utc_hour >= 10 THEN
    BEGIN
      PERFORM public.review_usd_activity(v_submission_id, 'approved', '');
      RAISE EXCEPTION 'utc_daily_limit_was_not_enforced';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'daily_limit_reached' THEN RAISE; END IF;
    END;
    IF NOT EXISTS (SELECT 1 FROM public.usd_reward_submissions WHERE id = v_submission_id AND status = 'pending') THEN
      RAISE EXCEPTION 'utc_limit_failure_changed_submission';
    END IF;
  ELSE
    v_result := public.review_usd_activity(v_submission_id, 'approved', '');
    IF coalesce((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'utc_daily_limit_included_previous_utc_day';
    END IF;
  END IF;
  RAISE NOTICE 'PASS: daily limits use UTC boundaries under a non-UTC session timezone';
END;
$acceptance$;

ROLLBACK;
