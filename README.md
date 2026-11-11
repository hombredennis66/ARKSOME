# ARKSOME

**Discover. Scroll. Explore. Get Rewarded.**

ARKSOME is a content-discovery platform where members browse a mixed feed of
articles, short videos and community content, complete optional activities, and
earn **ARKSOME Coins (AC)**.

> **ARKSOME Coins are not money.** They are internal platform points with no cash
> value, no exchange rate, no withdrawal and no transfer between users. Every
> coin balance change happens on the server through a validated reward engine.

---

## Stack

| Area | Technology |
| --- | --- |
| Web application | Next.js 16 (App Router) + React 19 |
| Language / UI | TypeScript (strict), Tailwind CSS v4 |
| Components | Local shadcn-style primitives in `src/components/ui` |
| Database / auth / storage | Supabase (PostgreSQL, Auth, Storage) |
| Authorization | Postgres Row Level Security + server-side role checks |
| Hosting | Vercel (recommended) |
| Advertising | Google Ad Manager / GPT — **not yet wired up**, pending policy approval |

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill in your Supabase keys
npm run dev
```

Open <http://localhost:3000>. The app runs in **preview mode** (built-in demo
feed) until Supabase credentials are added.

### 1. Configure Supabase

Create a project at <https://supabase.com>, then in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-only, never expose
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Apply the database schema

With the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/*.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # optional demo content
```

Or paste `supabase/migrations/20261111000001_initial_schema.sql` and then
`supabase/seed.sql` into the SQL Editor and run them.

Details: [`supabase/README.md`](supabase/README.md).

### 3. Enable email confirmation

Authentication → Providers → Email → **Confirm email** is recommended. Sign-ups
then require verification before a member can earn coins.

## Project layout

```
proxy.ts                      Next.js 16 request proxy: session refresh + route guards
supabase/
  migrations/                 Schema, RLS policies, reward engine functions
  seed.sql                    Reward configs, activities, quiz, demo content
src/
  app/
    (site)/                   Public: feed, content detail, legal pages
    (auth)/                   login, register, forgot-password
    (app)/                    Authenticated: dashboard, wallet, activities, ...
    admin/                    Protected admin area (server-side role checks)
    api/feed/                 Cursor-paginated feed endpoint
  components/                 UI primitives + feature components
  lib/
    actions/                  Server actions (rewards, bookmarks, admin)
    supabase/                 Browser / server / service-role clients
    auth.ts                   getAuthedUser, requireUser, requireAdmin
    rewards logic lives in SQL (see below)
```

## The reward engine

All coin movement is enforced in Postgres, not in the browser:

- `claim_reward(event_type, business_key, source, metadata)` — the only entry
  point for members. Resolves the caller from `auth.uid()` (the client cannot
  name a different user), checks the reward config, applies daily/lifetime caps,
  then in one transaction: locks the wallet → inserts a `reward_events` row →
  appends to the `coin_transactions` ledger → updates `wallets.balance`.
- **Idempotency**: `reward_events.idempotency_key` is
  `user:event:business_key` and UNIQUE, so duplicate or replayed claims return
  the original result instead of paying twice.
- **No write policies** exist on `wallets`, `coin_transactions` or
  `reward_events`, and `apply_reward()` has its execute privilege revoked from
  clients — the browser literally cannot set a balance.
- `submit_quiz_attempt()` grades answers server-side; the `answers` column is
  excluded from the column-level grant given to `anon`/`authenticated`.
- `admin_adjust_balance()` requires an authenticated admin and writes an audit row.

Rate limiting for sensitive actions lives in `src/lib/rate-limit.ts` (per
instance) with the database constraints as the hard backstop.

## Routes

| Public | Member | Admin (server-authorized) |
| --- | --- | --- |
| `/` feed | `/dashboard` | `/admin` |
| `/content/[slug]` | `/wallet` | `/admin/users` |
| `/about` `/contact` | `/activities` | `/admin/content` |
| `/terms` `/privacy` `/cookies` | `/bookmarks` `/referrals` | `/admin/ads` `/admin/rewards` |
| `/login` `/register` `/forgot-password` | `/notifications` `/settings` | `/admin/activities` `/admin/reports` `/admin/audit-logs` `/admin/settings` |

`proxy.ts` redirects unauthenticated visitors away from member routes and
non-operators away from `/admin`; every admin page **and** every admin server
action applies its server-side role check again — hiding links is never treated
as security. Moderators are limited to the reports area.

## Security notes

- Input is validated in server actions; redirects are restricted to same-site
  relative paths (no open redirects).
- Secrets are server-only: `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with
  `NEXT_PUBLIC_` and never imported by client components.
- RLS is enabled on every table; see the policies in the migration.
- Sensitive actions are written to `audit_logs` via `log_admin_action()`.
- Quiz answers, wallet rows and other members' private records are not readable
  through the API.

## Advertising status

Display, sponsored and rewarded ad placements are modelled in the database
(`ad_placements`, `campaigns`) and managed in `/admin/ads`, but **all placements
ship disabled**. Wire up Google Ad Manager / GPT only after account approval and
a review of the current rewarded-ad requirements. Rewarded ads must stay
voluntary, must never be required for basic functionality, and must never be
rewarded for mere impressions or clicks.

## Testing & launch checklist

- [ ] `npm run build` passes
- [ ] Register → verify email → sign in → daily check-in pays once (second attempt says already claimed)
- [ ] Quiz answers are not visible in the network tab; caps reject farming
- [ ] Non-admin gets redirected from every `/admin` route; RLS blocks direct table writes
- [ ] Mobile / tablet / desktop layouts checked
- [ ] Terms, privacy, cookies reviewed for your jurisdiction (Kenya DPA 2019 and others)
- [ ] Ad placements enabled only after provider approval

## Deployment

1. Push to GitHub and import into Vercel.
2. Set the production environment variables (never commit `.env.local`).
3. Run migrations against the production Supabase project and verify RLS.
4. Configure the custom domain + HTTPS, set `NEXT_PUBLIC_SITE_URL`.
5. Enable error monitoring and Supabase backups.
