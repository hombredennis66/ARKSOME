# ARKSOME

**Discover. Scroll. Explore. Get Rewarded.**

ARKSOME is a content-discovery platform where members browse articles, short videos, and community content, complete optional activities, and earn platform rewards.

The application uses two separate reward systems:

- **ARKSOME Coins (AC):** Internal platform points with no cash value, exchange rate, withdrawal, or transfer between users.
- **Simulated USD wallet:** A separate test-only accounting system that records simulated USD rewards in integer cents. It does not process real money, payments, transfers, or withdrawals.

---

## Technology stack

| Area | Technology |
|---|---|
| Web application | Next.js 16 App Router |
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| File storage | Supabase Storage |
| Authorization | PostgreSQL RLS and server-side role checks |
| Hosting | Render |
| Source control | Git and GitHub |

---

## Quick start

### Requirements

- Node.js and npm
- A Supabase project or local Supabase environment
- Git

### Installation

```bash
git clone <your-repository-url>
cd arksome
npm install
```

Create `.env.local` using `.env.example` as a reference.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never expose the service-role key in browser code or commit environment files.

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

Without Supabase credentials, the application runs in preview mode using its built-in demo feed.

---

## Database setup

ARKSOME uses Supabase PostgreSQL for its database, authentication, and storage.

### Apply migrations

Using the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
npm run db:push
```

For local development:

```bash
npm run db:start
npm run db:reset
```

Refer to [supabase/README.md](supabase/README.md) for detailed database setup, seed data, and local development instructions.

For a manual setup, apply the migration files in order using the Supabase SQL Editor. The optional seed contains demo content and should only be used in an appropriate development environment. From the project root, you can apply it with `psql "$DATABASE_URL" -f supabase/seed.sql` after setting `DATABASE_URL` for your development database. See `supabase/README.md` for the detailed procedure.

### Email confirmation

In Supabase Authentication → Providers → Email, enabling **Confirm email** is recommended. Sign-ups then require verification before a member can use earning features.

### Database migrations

The `supabase/migrations/` directory contains the database migration history.

| Migration | Purpose |
|---|---|
| `20261111000001_initial_schema.sql` | Initial application schema, authentication-related tables, RLS, and reward engine |
| `20261111000002_storage.sql` | Content media storage |
| `20261111135833_fix_handle_new_user_pgcrypto.sql` | Authentication trigger correction |
| `20261116000001_separate_ac_wallet.sql` | Separate AC wallet and ledger |
| `20261119000001_task_management.sql` | Task management functionality |
| `20261120000001_simulated_usd_wallet.sql` | Simulated USD wallet, activities, adjustments, and administration |

Apply migrations in order. Do not manually reapply migrations already recorded in the production migration history.

---

## Reward systems

### 1. ARKSOME Coins (AC)

AC is the platform's internal points system. Coins have no cash value, exchange rate, withdrawal, or transfer between members.

The AC wallet and transaction ledger use:

- `ac_wallets` — stores each member's current AC balance.
- `ac_transactions` — records AC credits and debits, including the resulting balance.

**Reward processing**

The PostgreSQL reward engine enforces reward configuration, eligibility, limits, and balance updates.

- `reward_configs` controls reward amounts, enabled status, daily limits, and per-user lifetime limits.
- `reward_events` records reward decisions, including granted and rejected events.
- `apply_reward(...)` processes configured rewards and updates the AC wallet and transaction ledger.
- Reward idempotency uses `user_id:event_type:business_key` to prevent duplicate credits.
- Previously rejected events cannot be retried with the same idempotency key.
- Wallet rows are locked during reward processing to serialize concurrent balance updates.
- Daily and lifetime reward limits are enforced in PostgreSQL.
- Zero-value rewards do not create a wallet transaction.
- `claim_reward(event_type, business_key, source, metadata)` resolves the member from `auth.uid()`, applies configured limits, and performs the wallet and ledger updates in one transaction.
- `reward_events.idempotency_key` prevents duplicate or replayed claims from paying twice.
- The browser cannot directly write wallet balances or transaction records; balance-changing functions enforce the operation server-side.

**Quiz rewards**

`submit_quiz_attempt(...)` handles quiz submissions and rewards.

- Only authenticated members can submit attempts.
- Only active quizzes are accepted.
- Answers are validated and graded server-side against the stored answer key.
- Daily attempt limits are enforced.
- Each attempt records the score and total questions.
- AC rewards are calculated using the `quiz_correct` reward configuration and the number of correct answers.
- Each rewarded attempt uses a unique attempt-based business key.

**Administrative adjustments**

`admin_adjust_balance(...)` allows authorized administrators to credit or debit AC balances.

- Requires administrator authorization through `is_admin()`.
- Requires a non-zero amount and a non-empty reason.
- Prevents debits that would result in a negative balance.
- Records the adjustment in `reward_events` and `ac_transactions`.
- Records the administrator, reason, and adjustment direction.
- Writes an administrative audit entry through `log_admin_action(...)`.

**Database access and permissions**

- Row Level Security protects AC wallet and transaction records.
- Browser clients cannot directly modify wallet balances or transaction records.
- `get_ac_balance()` allows authenticated members to retrieve their own balance.
- `get_ac_balance_for(uuid)` is restricted from client execution.
- `apply_reward(...)` is executable by `service_role`, not ordinary client roles.
- `submit_quiz_attempt(...)` and `admin_adjust_balance(...)` are executable by authenticated users, with authorization enforced inside the functions.
- `claim_reward(...)` remains an authenticated reward-claim entry point.
- Quiz answer columns are not exposed through ordinary client grants; quiz submissions are graded server-side against the stored answer key.

Rate limiting for sensitive actions lives in `src/lib/rate-limit.ts`; database constraints and functions remain the hard enforcement backstop.

### 2. Simulated USD wallet

The simulated USD wallet is a separate test-only accounting system.

- Balances are stored as integer cents.
- 100 cents represent $1.00 TEST.
- Members submit eligible activities for administrative review.
- Approved activities generate corresponding ledger entries.
- Administrative adjustments require a reason and idempotency key
- Duplicate approvals are protected against duplicate credits.
- Negative balances are prevented.
- Financial and audit records are retained when member accounts are deleted.

The simulated USD system uses the legacy USD wallet and ledger:

- `wallets`
- `coin_transactions`

Additional records:

- `account_records`
- `usd_reward_configs`
- `usd_reward_submissions`
- `usd_admin_adjustments`

The USD system does not modify or share balances with the AC wallet.

**Important:** Simulated USD is not real currency. No real payments, withdrawals, cash-outs, or transfers are supported.

---

## Application routes

| Area | Route | Purpose |
|---|---|---|
| Public | `/` | Content feed |
| Public | `/content/[slug]` | Content details |
| Member | `/dashboard` | Member dashboard |
| Member | `/wallet` | Wallet balances and history |
| Member | `/activities` | Platform activities |
| Member | `/usd-activities` | Simulated USD activity submissions |
| Admin | `/admin` | Administration dashboard |
| Admin | `/admin/users` | User management |
| Admin | `/admin/rewards` | AC reward management |
| Admin | `/admin/usd-rewards` | Simulated USD reward management |
| Admin | `/admin/activities` | Activity administration |
| Admin | `/admin/content` | Content administration |
| Admin | `/admin/ads` | Advertising administration |

Routes are protected through request proxy checks and server-side authorization. Administrative actions must independently enforce authorization.

Other supported routes include `/about`, `/contact`, `/terms`, `/privacy`, `/cookies`, `/login`, `/register`, `/forgot-password`, `/bookmarks`, `/referrals`, `/notifications`, `/settings`, `/admin/reports`, `/admin/audit-logs`, and `/admin/settings`.

`proxy.ts` refreshes sessions and redirects unauthenticated visitors away from member routes and non-operators away from `/admin`. Admin pages and server actions repeat their role checks; hiding navigation links is not treated as authorization. Moderators are limited to the reports area.

---

## Security

ARKSOME uses multiple layers of access control:

- PostgreSQL Row Level Security protects database records.
- Server-side role checks authorize administrative operations.
- Members can access only their permitted records.
- Wallet balances cannot be directly modified by browser clients.
- Sensitive administrative operations are audited.
- Financial ledger records are retained for audit and recordkeeping.
- Environment secrets are kept outside source control.
- Redirects from server actions are restricted to safe same-site relative paths.
- The service-role key is server-only: never prefix it with `NEXT_PUBLIC_` or import it into client components.
- Administrative events are recorded through `log_admin_action(...)` and the audit log.
- Quiz answers and other members' private records are not readable through the browser API.

Do not commit `.env.local`, service-role keys, database passwords, or production credentials.

---

## Manual database backups

A local manual backup directory is maintained at:

```text
backups/
```

The directory contains the following files:

| File | Purpose |
|---|---|
| `arksome_schema.sql` | Database schema export |
| `arksome_data.sql` | Database data export |
| `arksome_roles.sql` | Database roles export |
| `arksome_auth.sql` | Authentication data export |
| `arksome_migrations.sql` | Migration history export |
| `arksome_storage.sql` | Storage metadata export |
| `arksome_schema_restore.sql` | Schema restore helper |
| `arksome_rls_restore.sql` | RLS restore helper |
| `arksome_storage_restore.sql` | Storage restore helper |
| `BACKUP_MANIFEST.txt` | Backup metadata and original checksums |
| `SHA256SUMS.txt` | SHA-256 checksums for backup SQL files |

### Verify backup integrity

From the project root:

```bash
cd backups
sha256sum -c SHA256SUMS.txt
cd ..
```

Every SQL file should report `OK`.

### Backup security

**The `backups/` directory is intentionally excluded from Git.**

These files contain database and potentially sensitive production information. Keep them in secure storage and maintain an additional protected copy outside the project directory.

Never upload production backups to a public Git repository.

### Restore considerations

1. Verify backup checksums before restoration.
2. Review `BACKUP_MANIFEST.txt`.
3. Restore into an isolated environment when testing.
4. Follow the appropriate schema, role, authentication, data, migration, RLS, and storage restoration requirements.
5. Verify tables, foreign keys, RLS policies, authentication records, and wallet ledgers after restoration.
6. Do not restore production backups over a live database without a separately approved recovery procedure.

The local restore sandbox is a separate testing environment, not part of the production deployment.

---

## Testing

Run the available project checks before committing changes:

```bash
npm run lint
npx tsc --noEmit
```

The simulated USD wallet acceptance test is located at:

```text
supabase/tests/simulated_usd_wallet_acceptance.sql
```

The production page smoke test should cover:

- `/wallet`
- `/usd-activities`
- `/admin/usd-rewards`
- `/admin/users`

Test member routes using a member account and administrative routes using an appropriately authorized account.

Before a release, verify the following:

- [ ] `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.
- [ ] Register, verify email, and sign in; confirm daily check-in pays once and a second attempt is rejected.
- [ ] Quiz answers are not exposed to the browser, and reward caps reject repeated claims.
- [ ] Non-admin users are redirected from admin routes, and RLS blocks direct wallet writes.
- [ ] Member and administrator smoke tests pass for the USD and AC wallet routes.
- [ ] Mobile, tablet, and desktop layouts are checked.
- [ ] Terms, privacy, and cookie policies are reviewed for applicable jurisdictions.
- [ ] Advertising stays disabled until provider approval and policy review.

---

## Deployment

ARKSOME production is hosted on Render.

Production application:

https://arksome.onrender.com

### Deployment workflow

1. Make and test changes locally.
2. Review the Git diff.
3. Commit changes to the `main` branch.
4. Push to GitHub.
5. Render automatically deploys changes from the connected repository.
6. Verify the deployment and test affected application routes.

Database migrations should be reviewed and applied separately to the intended Supabase environment. A Git push does not itself prove that a database migration has been applied.

Keep production environment variables configured securely in Render. Apply Supabase migrations to the intended project and verify RLS; configure the production domain, HTTPS, and `NEXT_PUBLIC_SITE_URL`; and maintain error monitoring and verified database backups.

---

## Advertising status

Advertising placements are modelled in the database (`ad_placements`, `campaigns`) and managed through `/admin/ads`. Keep all placements disabled until the provider account is approved and the current policy requirements have been reviewed.

Rewarded advertising must remain voluntary, must not be required for basic functionality, and must not grant rewards for impressions or clicks alone.

---

## Project structure

```text
arksome/
├── backups/                 Local production backup files (Git-ignored)
├── public/                  Static assets
├── src/
│   ├── app/
│   │   ├── (site)/          Public routes
│   │   ├── (auth)/          Authentication routes
│   │   ├── (app)/           Authenticated member routes
│   │   ├── admin/           Administrative routes
│   │   └── api/             API endpoints
│   ├── components/          UI and feature components
│   └── lib/                 Actions, utilities and Supabase clients
├── supabase/
│   ├── migrations/          Database migrations
│   ├── tests/               Database acceptance tests
│   ├── README.md            Database documentation
│   └── seed.sql             Development seed data
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Key entry points include `proxy.ts` for session refresh and route guards, `src/lib/actions/` for server actions, and `src/lib/supabase/` for browser, server, and service-role clients. Reward calculations and balance updates live in PostgreSQL functions.

---

## Project maintenance

- Keep database migrations version-controlled.
- Update TypeScript database types when the schema changes.
- Keep AC and simulated USD accounting separate.
- Preserve financial and audit history.
- Verify backups regularly.
- Never commit production secrets or backup data.
- Test production changes after deployment.
