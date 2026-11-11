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

  -- Explicitly reference pgcrypto in the extensions schema.
  v_ref_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));

  insert into public.profiles (id, username, display_name, referral_code)
  values (new.id, v_username, v_display, v_ref_code)
  on conflict (id) do nothing;

  if exists (
    select 1 from public.profiles
    where username = v_username and id <> new.id
  ) then
    update public.profiles
       set username = v_username || '_' || substr(new.id::text, 1, 6)
     where id = new.id;
  end if;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict do nothing;

  v_ref_code := nullif(new.raw_user_meta_data ->> 'referral_code', '');

  if v_ref_code is not null then
    select id into v_referrer
    from public.profiles
    where referral_code = upper(v_ref_code);

    if v_referrer is not null and v_referrer <> new.id then
      insert into public.referrals (referrer_id, referred_id, status)
      values (v_referrer, new.id, 'pending')
      on conflict (referred_id) do nothing;

      perform public.apply_reward(
        v_referrer,
        'referral_signup',
        new.id::text,
        'referral',
        jsonb_build_object('referred_user', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;