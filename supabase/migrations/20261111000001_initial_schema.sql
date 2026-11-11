-- ===========================================================================
-- ARKSOME — initial database schema
-- PostgreSQL (Supabase) — profiles, content, rewards, admin and privacy tables
--
-- Design rules enforced here:
--   * Coin balances live in `wallets` and are ONLY changed by trusted
--     SECURITY DEFINER functions. There are no INSERT/UPDATE policies on
--     wallets or coin_transactions, so the browser can never set a balance.
--   * `coin_transactions` is an immutable append-only ledger.
--   * `reward_events.idempotency_key` is unique, which makes duplicate or
--     replayed reward claims impossible.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('member', 'moderator', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_type as enum ('article', 'video', 'short', 'community');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_status as enum ('draft', 'pending', 'published', 'rejected', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('credit', 'debit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum ('draft', 'active', 'paused', 'ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_status as enum ('pending', 'credited', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Identity & profile
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique,
  display_name  text,
  avatar_url    text,
  bio           text,
  referral_code text unique,
  join_date     timestamptz not null default now(),
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.user_role not null default 'member',
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists user_roles_user_idx on public.user_roles (user_id);

create table if not exists public.user_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  email_notifications boolean not null default true,
  marketing_consent   boolean not null default false,
  rewarded_ads_enabled boolean not null default true,
  theme               text not null default 'system',
  updated_at          timestamptz not null default now()
);

create table if not exists public.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  consent_type text not null,
  granted      boolean not null,
  source       text not null default 'web',
  created_at   timestamptz not null default now()
);
create index if not exists consents_user_idx on public.consents (user_id, consent_type);

-- ---------------------------------------------------------------------------
-- Rewards: wallet + immutable ledger + configuration + events
-- ---------------------------------------------------------------------------
create table if not exists public.wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_configs (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,
  label           text not null,
  amount          integer not null check (amount >= 0),
  daily_limit     integer check (daily_limit is null or daily_limit >= 0),
  per_user_limit  integer check (per_user_limit is null or per_user_limit >= 0),
  enabled         boolean not null default true,
  description     text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null
);

create table if not exists public.reward_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  event_type      text not null,
  business_key    text not null,
  idempotency_key text not null unique,
  amount          integer not null check (amount >= 0),
  status          text not null default 'granted' check (status in ('granted', 'rejected')),
  source          text not null default 'app',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists reward_events_user_type_idx on public.reward_events (user_id, event_type, created_at desc);
create index if not exists reward_events_created_idx on public.reward_events (created_at desc);

create table if not exists public.coin_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            public.transaction_type not null,
  amount          integer not null check (amount > 0),
  balance_after   integer not null check (balance_after >= 0),
  reason          text not null,
  source          text not null default 'app',
  reward_event_id uuid references public.reward_events (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists coin_transactions_user_idx on public.coin_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Content & discovery
-- ---------------------------------------------------------------------------
create table if not exists public.content (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  type             public.content_type not null default 'article',
  status           public.content_status not null default 'draft',
  title            text not null,
  excerpt          text,
  body             text,
  cover_url        text,
  video_url        text,
  duration_seconds integer,
  author_id        uuid references auth.users (id) on delete set null,
  is_sponsored     boolean not null default false,
  sponsor_name     text,
  tags             text[] not null default '{}',
  view_count       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  published_at     timestamptz,
  constraint sponsored_requires_name check (not is_sponsored or sponsor_name is not null)
);
create index if not exists content_feed_idx on public.content (published_at desc, id desc)
  where status = 'published';
create index if not exists content_status_idx on public.content (status, updated_at desc);
create index if not exists content_tags_idx on public.content using gin (tags);

create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, content_id)
);

create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  content_id  uuid not null references public.content (id) on delete cascade,
  reason      text not null,
  details     text,
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  unique (reporter_id, content_id)
);

-- ---------------------------------------------------------------------------
-- Activities, quizzes, check-ins, referrals
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  title         text not null,
  description   text,
  activity_type text not null default 'checkin',
  reward_amount integer not null default 0 check (reward_amount >= 0),
  enabled       boolean not null default true,
  config        jsonb not null default '{}'::jsonb,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.quizzes (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  title                text not null,
  description          text,
  reward_amount        integer not null default 0 check (reward_amount >= 0),
  max_attempts_per_day integer not null default 1 check (max_attempts_per_day >= 1),
  is_active            boolean not null default true,
  questions            jsonb not null default '[]'::jsonb,
  -- Answers are intentionally a separate column: it is excluded from the
  -- column-level grant given to anon/authenticated, so clients never receive
  -- the answer key. Grading happens server-side in submit_quiz_attempt().
  answers              jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  quiz_id    uuid not null references public.quizzes (id) on delete cascade,
  score      integer not null default 0,
  total      integer not null default 0,
  rewarded   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);

create table if not exists public.daily_checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  checkin_date   date not null,
  streak_count   integer not null default 1 check (streak_count >= 1),
  coins_awarded  integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (user_id, checkin_date)
);
create index if not exists daily_checkins_user_idx on public.daily_checkins (user_id, checkin_date desc);

create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  status      public.referral_status not null default 'pending',
  created_at  timestamptz not null default now(),
  credited_at timestamptz
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Notifications, ads, campaigns, audit
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null default 'system',
  title      text not null,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.ad_placements (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  name       text not null,
  location   text not null,
  format     text not null default 'display',
  enabled    boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  sponsor      text,
  status       public.campaign_status not null default 'draft',
  content_id   uuid references public.content (id) on delete set null,
  starts_at    timestamptz,
  ends_at      timestamptz,
  budget_coins integer check (budget_coins is null or budget_coins >= 0),
  impressions  integer not null default 0,
  clicks       integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile, wallet, settings, role, referral
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username   text;
  v_ref_code   text;
  v_referrer   uuid;
  v_display    text;
begin
  v_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(new.email, new.id::text), '@', 1)
  );
  v_display := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), v_username);
  v_ref_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));

  insert into public.profiles (id, username, display_name, referral_code)
  values (new.id, v_username, v_display, v_ref_code)
  on conflict (id) do nothing;

  -- Username collisions: append a short suffix instead of failing signup.
  if exists (select 1 from public.profiles where username = v_username and id <> new.id) then
    update public.profiles
       set username = v_username || '_' || substr(new.id::text, 1, 6)
     where id = new.id;
  end if;

  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'member') on conflict do nothing;

  -- Optional referral attribution passed through signUp metadata.
  v_ref_code := nullif(new.raw_user_meta_data ->> 'referral_code', '');
  if v_ref_code is not null then
    select id into v_referrer from public.profiles where referral_code = upper(v_ref_code);
    if v_referrer is not null and v_referrer <> new.id then
      insert into public.referrals (referrer_id, referred_id, status)
      values (v_referrer, new.id, 'pending')
      on conflict (referred_id) do nothing;

      -- Reward the referrer through the same validated engine.
      perform public.apply_reward(
        v_referrer, 'referral_signup', new.id::text,
        'referral', jsonb_build_object('referred_user', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

-- The trigger itself is created at the end of this file, after the reward
-- engine functions that handle_new_user() calls at runtime.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'super_admin', 'moderator')
  );
$$;

create or replace function public.get_balance()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select balance from public.wallets where user_id = auth.uid()), 0);
$$;

create or replace function public.log_admin_action(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- ===========================================================================
-- REWARD ENGINE
-- ===========================================================================

-- Core award routine. Only reachable from other SECURITY DEFINER functions
-- (execute privileges are revoked from clients below).
create or replace function public.apply_reward(
  p_user_id       uuid,
  p_event_type    text,
  p_business_key  text,
  p_source        text,
  p_metadata      jsonb default '{}'::jsonb,
  p_amount_override integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config     public.reward_configs%rowtype;
  v_balance    integer;
  v_amount     integer;
  v_count      integer;
  v_event_id   uuid;
  v_existing   public.reward_events%rowtype;
  v_idem       text;
  v_meta       jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_user');
  end if;

  -- Idempotency: the same (user, event, business key) is processed exactly once.
  v_idem := p_user_id || ':' || p_event_type || ':' || p_business_key;
  select * into v_existing from public.reward_events where idempotency_key = v_idem;
  if found then
    select balance into v_balance from public.wallets where user_id = p_user_id;
    if v_existing.status = 'granted' then
      return jsonb_build_object(
        'ok', true, 'duplicate', true, 'amount', v_existing.amount,
        'balance', coalesce(v_balance, 0), 'event_id', v_existing.id
      );
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_rejected', 'reason', v_existing.metadata ->> 'reason');
  end if;

  select * into v_config from public.reward_configs where key = p_event_type;
  if not found or not v_config.enabled then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  v_amount := coalesce(p_amount_override, v_config.amount);
  if v_amount is null or v_amount < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  -- Daily cap per event type.
  if v_config.daily_limit is not null then
    select count(*) into v_count
      from public.reward_events
     where user_id = p_user_id
       and event_type = p_event_type
       and status = 'granted'
       and created_at >= date_trunc('day', now());
    if v_count >= v_config.daily_limit then
      insert into public.reward_events (user_id, event_type, business_key, idempotency_key, amount, status, source, metadata)
      values (p_user_id, p_event_type, p_business_key, v_idem, 0, 'rejected', p_source,
              v_meta || jsonb_build_object('reason', 'daily_limit_reached'))
      on conflict (idempotency_key) do nothing;
      return jsonb_build_object('ok', false, 'error', 'daily_limit_reached', 'limit', v_config.daily_limit);
    end if;
  end if;

  -- Lifetime cap per user per event type.
  if v_config.per_user_limit is not null then
    select count(*) into v_count
      from public.reward_events
     where user_id = p_user_id and event_type = p_event_type and status = 'granted';
    if v_count >= v_config.per_user_limit then
      insert into public.reward_events (user_id, event_type, business_key, idempotency_key, amount, status, source, metadata)
      values (p_user_id, p_event_type, p_business_key, v_idem, 0, 'rejected', p_source,
              v_meta || jsonb_build_object('reason', 'per_user_limit_reached'))
      on conflict (idempotency_key) do nothing;
      return jsonb_build_object('ok', false, 'error', 'per_user_limit_reached', 'limit', v_config.per_user_limit);
    end if;
  end if;

  if v_amount = 0 then
    return jsonb_build_object('ok', true, 'duplicate', false, 'amount', 0,
                              'balance', public.get_balance_for(p_user_id));
  end if;

  -- Lock the wallet row so concurrent claims cannot interleave.
  select balance into v_balance from public.wallets where user_id = p_user_id for update;
  if not found then
    insert into public.wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
    select balance into v_balance from public.wallets where user_id = p_user_id for update;
  end if;

  insert into public.reward_events (user_id, event_type, business_key, idempotency_key, amount, status, source, metadata)
  values (p_user_id, p_event_type, p_business_key, v_idem, v_amount, 'granted', p_source, v_meta)
  returning id into v_event_id;

  v_balance := v_balance + v_amount;

  insert into public.coin_transactions (user_id, type, amount, balance_after, reason, source, reward_event_id)
  values (p_user_id, 'credit', v_amount, v_balance, v_config.label, p_source, v_event_id);

  update public.wallets set balance = v_balance, updated_at = now() where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true, 'duplicate', false, 'amount', v_amount,
    'balance', v_balance, 'event_id', v_event_id, 'label', v_config.label
  );
end;
$$;

create or replace function public.get_balance_for(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select balance from public.wallets where user_id = p_user_id), 0);
$$;

-- Public entry point for a signed-in member claiming their own reward.
create or replace function public.claim_reward(
  p_event_type   text,
  p_business_key text,
  p_source       text default 'app',
  p_metadata     jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_banned boolean;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select is_banned into v_banned from public.profiles where id = v_user;
  if coalesce(v_banned, false) then
    return jsonb_build_object('ok', false, 'error', 'account_restricted');
  end if;

  return public.apply_reward(v_user, p_event_type, p_business_key, p_source, p_metadata, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Quiz submission: graded server-side, rewarded atomically.
-- The client never receives the answer key (column-level privileges).
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(
  p_quiz_slug text,
  p_answers   jsonb,
  p_source    text default 'quiz'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_quiz      public.quizzes%rowtype;
  v_answers   jsonb;
  v_correct   integer := 0;
  v_total     integer;
  v_attempt   uuid;
  v_today     integer;
  v_cfg       public.reward_configs%rowtype;
  v_amount    integer;
  v_award     jsonb;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select * into v_quiz from public.quizzes where slug = p_quiz_slug and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'quiz_not_found');
  end if;

  v_answers := v_quiz.answers;
  v_total := jsonb_array_length(v_quiz.questions);
  if p_answers is null or jsonb_typeof(p_answers) <> 'array'
     or jsonb_array_length(p_answers) <> v_total then
    return jsonb_build_object('ok', false, 'error', 'invalid_submission');
  end if;

  -- Attempts per day (anti-farming).
  select count(*) into v_today
    from public.quiz_attempts
   where user_id = v_user and quiz_id = v_quiz.id
     and created_at >= date_trunc('day', now());
  if v_today >= v_quiz.max_attempts_per_day then
    return jsonb_build_object('ok', false, 'error', 'attempts_exhausted',
                              'limit', v_quiz.max_attempts_per_day);
  end if;

  for i in 0 .. v_total - 1 loop
    if (p_answers ->> i)::int = (v_answers ->> i)::int then
      v_correct := v_correct + 1;
    end if;
  end loop;

  insert into public.quiz_attempts (user_id, quiz_id, score, total, rewarded)
  values (v_user, v_quiz.id, v_correct, v_total, v_correct > 0)
  returning id into v_attempt;

  if v_correct > 0 then
    select * into v_cfg from public.reward_configs where key = 'quiz_correct';
    v_amount := coalesce(v_cfg.amount, 0) * v_correct;

    if v_amount > 0 then
      v_award := public.apply_reward(
        v_user, 'quiz_correct', v_quiz.slug || ':' || v_attempt::text,
        p_source,
        jsonb_build_object('quiz_slug', v_quiz.slug, 'score', v_correct, 'total', v_total),
        v_amount
      );
    else
      v_award := jsonb_build_object('ok', true, 'amount', 0, 'balance', public.get_balance_for(v_user));
    end if;
  else
    v_award := jsonb_build_object('ok', true, 'amount', 0, 'balance', public.get_balance_for(v_user));
  end if;

  return jsonb_build_object(
    'ok', true, 'attempt_id', v_attempt, 'correct', v_correct, 'total', v_total,
    'award', v_award
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Locked, mutable admin-only helper for manual adjustments (never exposed to
-- the browser: requires an authenticated admin session).
-- ---------------------------------------------------------------------------
create or replace function public.admin_adjust_balance(
  p_user_id  uuid,
  p_amount   integer,
  p_reason   text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_event   uuid;
  v_business_key text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;
  v_business_key := gen_random_uuid()::text;
  if p_amount = 0 or p_amount is null then
    raise exception 'invalid_amount';
  end if;

  select balance into v_balance from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'wallet_not_found';
  end if;

  if p_amount < 0 and v_balance + p_amount < 0 then
    raise exception 'insufficient_balance';
  end if;

  insert into public.reward_events (user_id, event_type, business_key, idempotency_key, amount, status, source, metadata)
  values (p_user_id, 'admin_adjustment', v_business_key,
          p_user_id || ':admin_adjustment:' || v_business_key,
          abs(p_amount), 'granted', 'admin',
          jsonb_build_object('reason', p_reason, 'actor', auth.uid(), 'direction', case when p_amount > 0 then 'credit' else 'debit' end))
  returning id into v_event;

  v_balance := v_balance + p_amount;

  if p_amount > 0 then
    insert into public.coin_transactions (user_id, type, amount, balance_after, reason, source, reward_event_id)
    values (p_user_id, 'credit', p_amount, v_balance, p_reason, 'admin', v_event);
  else
    insert into public.coin_transactions (user_id, type, amount, balance_after, reason, source, reward_event_id)
    values (p_user_id, 'debit', abs(p_amount), v_balance, p_reason, 'admin', v_event);
  end if;

  update public.wallets set balance = v_balance, updated_at = now() where user_id = p_user_id;

  perform public.log_admin_action('balance_adjustment', 'wallet', p_user_id::text,
    jsonb_build_object('amount', p_amount, 'reason', p_reason));

  return jsonb_build_object('ok', true, 'balance', v_balance);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: clients can only call the validated entry points.
-- ---------------------------------------------------------------------------
revoke all on function public.apply_reward(uuid, text, text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.get_balance_for(uuid) from public, anon, authenticated;
revoke all on function public.submit_quiz_attempt(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.admin_adjust_balance(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.log_admin_action(text, text, text, jsonb) from public, anon, authenticated;

revoke execute on function public.claim_reward(text, text, text, jsonb) from public, anon;
grant execute on function public.claim_reward(text, text, text, jsonb) to authenticated;
grant execute on function public.submit_quiz_attempt(text, jsonb, text) to authenticated;
grant execute on function public.get_balance() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;
grant execute on function public.admin_adjust_balance(uuid, integer, text) to authenticated;

-- Answer key is never readable by clients: only the selected columns are
-- granted to anon/authenticated (answers is excluded).
revoke select on table public.quizzes from anon, authenticated;
grant select (id, slug, title, description, reward_amount, max_attempts_per_day, is_active, questions, created_at)
  on table public.quizzes to authenticated;
grant select (id, slug, title, description, reward_amount, max_attempts_per_day, is_active, created_at)
  on table public.quizzes to anon;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_settings enable row level security;
alter table public.consents enable row level security;
alter table public.wallets enable row level security;
alter table public.reward_configs enable row level security;
alter table public.reward_events enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.content enable row level security;
alter table public.bookmarks enable row level security;
alter table public.content_reports enable row level security;
alter table public.activities enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.referrals enable row level security;
alter table public.notifications enable row level security;
alter table public.ad_placements enable row level security;
alter table public.campaigns enable row level security;
alter table public.audit_logs enable row level security;
alter table public.quizzes enable row level security;

-- profiles: public read (no email stored here), self-service write.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete using (id = auth.uid());

-- user_roles: readable by self and admins; written only via admin paths.
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select
  using (user_id = auth.uid() or public.is_admin());

-- settings & consents: strictly private.
drop policy if exists user_settings_all on public.user_settings;
create policy user_settings_all on public.user_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists consents_all on public.consents;
create policy consents_all on public.consents for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Wallets / ledger / events: read-only for the owner. NO write policies on
-- purpose — balances are changed exclusively by SECURITY DEFINER functions.
drop policy if exists wallets_select on public.wallets;
create policy wallets_select on public.wallets for select using (user_id = auth.uid());

drop policy if exists coin_transactions_select on public.coin_transactions;
create policy coin_transactions_select on public.coin_transactions for select using (user_id = auth.uid());

drop policy if exists reward_events_select on public.reward_events;
create policy reward_events_select on public.reward_events for select
  using (user_id = auth.uid() or public.is_admin());

-- Reward rules are public so members can verify what each action pays.
drop policy if exists reward_configs_select on public.reward_configs;
create policy reward_configs_select on public.reward_configs for select using (true);

-- Content: published items are public; authors manage their own; admins all.
drop policy if exists content_select on public.content;
create policy content_select on public.content for select using (
  (status = 'published' and published_at <= now())
  or author_id = auth.uid()
  or public.is_admin()
);
drop policy if exists content_insert on public.content;
create policy content_insert on public.content for insert with check (
  author_id = auth.uid() and status in ('draft', 'pending')
);
drop policy if exists content_update on public.content;
create policy content_update on public.content for update
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
drop policy if exists content_delete on public.content;
create policy content_delete on public.content for delete
  using (author_id = auth.uid() or public.is_admin());

drop policy if exists bookmarks_all on public.bookmarks;
create policy bookmarks_all on public.bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports for insert
  with check (reporter_id = auth.uid());
drop policy if exists content_reports_select on public.content_reports;
create policy content_reports_select on public.content_reports for select
  using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists content_reports_update on public.content_reports;
create policy content_reports_update on public.content_reports for update
  using (public.is_admin()) with check (public.is_admin());

-- Activities & quizzes: readable when enabled, admin-managed otherwise.
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select using (enabled or public.is_admin());

drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes for select using (is_active or public.is_admin());

drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts for select using (user_id = auth.uid());

drop policy if exists daily_checkins_select on public.daily_checkins;
create policy daily_checkins_select on public.daily_checkins for select using (user_id = auth.uid());

drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals for select
  using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete using (user_id = auth.uid());

-- Ads & campaigns: public read of enabled placements/active campaigns,
-- admin-only writes (no write policies = definer/admin paths only).
drop policy if exists ad_placements_select on public.ad_placements;
create policy ad_placements_select on public.ad_placements for select
  using (enabled or public.is_admin());
drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns for select
  using ((status = 'active' and (starts_at is null or starts_at <= now())
          and (ends_at is null or ends_at >= now())) or public.is_admin());

-- Audit logs: admin read, no client writes (inserted through log_admin_action).
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists content_touch on public.content;
create trigger content_touch before update on public.content
  for each row execute function public.touch_updated_at();

drop trigger if exists reward_configs_touch on public.reward_configs;
create trigger reward_configs_touch before update on public.reward_configs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New-user trigger (created last: it calls the reward engine at runtime)
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
