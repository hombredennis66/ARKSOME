# ARKSOME database

PostgreSQL (Supabase) schema for ARKSOME.

## Files

| File | Purpose |
| --- | --- |
| `migrations/20261111000001_initial_schema.sql` | Tables, enums, indexes, triggers, RLS policies, reward-engine functions |
| `seed.sql` | Reward configurations, activities, one quiz, ad placements, demo content |

## Applying

### Supabase CLI (recommended)

```bash
npm run db:start                         # local Postgres, Auth, Storage and Studio
npm run db:reset                         # apply migrations + seed locally
supabase link --project-ref <your-project-ref>
npm run db:push                          # apply migrations to the linked project
```

The committed `config.toml` enables email confirmation locally, local SMTP
capture, and the `content-media` Storage bucket. Local confirmation emails are
available in Supabase Studio at <http://127.0.0.1:54323>.

### SQL Editor

Open **SQL Editor → New query** in the Supabase dashboard, paste the migration
file, then run it. Repeat for `seed.sql`.

> Run the migration **before** `seed.sql` — the seed inserts into tables and
> foreign keys created by the migration.

## What the migration creates

**Tables** — `profiles`, `user_roles`, `user_settings`, `consents`, `wallets`,
`reward_configs`, `reward_events`, `coin_transactions`, `content`, `bookmarks`,
`content_reports`, `activities`, `quizzes`, `quiz_attempts`, `daily_checkins`,
`referrals`, `notifications`, `ad_placements`, `campaigns`, `audit_logs`.

**Storage** — migration `20261111000002_storage.sql` creates the public
`content-media` bucket with a 50 MiB limit. Authenticated users can upload,
replace and delete only objects under their own `<user-id>/` folder; public
reads are allowed for published media URLs.

**Trigger** — `on_auth_user_created` bootstraps a profile (with referral code),
wallet, settings row and `member` role for every new auth user, and attributes
an optional referral from `raw_user_meta_data.referral_code`.

**Reward engine** (all `SECURITY DEFINER`, all caps enforced in SQL):

| Function | Who can call it | What it does |
| --- | --- | --- |
| `claim_reward(type, business_key, source, metadata)` | `authenticated` | Awards coins to `auth.uid()` after config/cap/idempotency checks |
| `submit_quiz_attempt(slug, answers, source)` | `authenticated` | Grades against the hidden answer key, records the attempt, awards per correct answer |
| `get_balance()` | `authenticated` | Caller's balance |
| `log_admin_action(...)` | `authenticated` + admin | Appends to `audit_logs` |
| `admin_adjust_balance(user, amount, reason)` | authenticated + admin | Manual credit/debit with audit |
| `apply_reward(...)`, `get_balance_for(...)` | **nobody directly** | Internal helpers; execute is revoked from clients |

## Row Level Security highlights

- `wallets`, `coin_transactions`, `reward_events`: **read-only for the owner**,
  no write policies at all — balances change only through the functions above.
- `content`: published rows are public; authors manage their own; admins manage
  all. Sponsors must provide a `sponsor_name` (CHECK constraint).
- `quizzes`: clients are granted only specific columns — `answers` is excluded.
- `audit_logs`, `reward_configs`, `activities`, `ad_placements`, `campaigns`:
  admin-gated writes (no client write policies).
- `bookmarks`, `notifications`, `user_settings`, `consents`, `daily_checkins`:
  strictly the owner's own rows.

## Regenerating TypeScript types

`src/lib/database.types.ts` is hand-written to mirror this schema. If you change
the schema, either update that file or regenerate:

```bash
npm run db:types
```

## Notes

- `reward_events.idempotency_key` is `user_id:event_type:business_key` and
  UNIQUE — this is what makes duplicate/replayed claims impossible.
- `coin_transactions` is append-only by convention; there is no UPDATE policy
  and no application code that mutates it.
- Reward values and limits are data (`reward_configs`), editable at
  `/admin/rewards` — no redeploy needed to change an amount.
