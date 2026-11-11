import Link from "next/link";
import { Search, UsersRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/database.types";
import { formatDate, formatCoins } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 100;
const EMAIL_PAGES = 5;
const EMAIL_PAGE_SIZE = 100;

const ROLE_BADGE: Record<UserRole, "default" | "secondary" | "muted" | "coin"> = {
  member: "muted",
  moderator: "secondary",
  admin: "default",
  super_admin: "coin",
};

type UserListRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  isBanned: boolean;
  createdAt: string;
  role: UserRole;
  balance: number | null;
};

/**
 * Pull id→email from Supabase Auth (profiles never stores email). Only
 * possible with the service-role key; capped to keep the query reasonable.
 */
async function loadAuthEmails(
  service: NonNullable<ReturnType<typeof getServiceClient>>,
): Promise<{ emails: Map<string, string>; truncated: boolean }> {
  const emails = new Map<string, string>();
  let truncated = false;
  for (let page = 1; page <= EMAIL_PAGES; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: EMAIL_PAGE_SIZE });
    if (error || !data) break;
    for (const authUser of data.users) {
      if (authUser.email) emails.set(authUser.id, authUser.email.toLowerCase());
    }
    if (data.users.length < EMAIL_PAGE_SIZE) break;
    if (page === EMAIL_PAGES) truncated = true;
  }
  return { emails, truncated };
}

/** Strip characters that could break PostgREST `or=()` filter syntax. */
function sanitizeQuery(raw: string | undefined): string {
  return (raw ?? "").replace(/[,%()"'\\]/g, " ").trim().slice(0, 60);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireAdmin();
  const { q: rawQ } = await searchParams;
  const q = sanitizeQuery(typeof rawQ === "string" ? rawQ : undefined);
  const qLower = q.toLowerCase();

  const supabase = await createClient();
  const service = getServiceClient();
  const serviceReady = Boolean(service);

  let rows: UserListRow[] = [];
  let emailTruncated = false;
  let loadError: string | null = null;

  if (supabase) {
    const emails = new Map<string, string>();
    if (service) {
      const result = await loadAuthEmails(service);
      for (const [id, email] of result.emails) emails.set(id, email);
      emailTruncated = result.truncated;
    }

    const profileSelect = "id, username, display_name, avatar_url, is_banned, created_at";
    const profileQuery = supabase.from("profiles").select(profileSelect);

    let profileRows: { id: string; username: string | null; display_name: string | null; is_banned: boolean; created_at: string }[] = [];

    if (q) {
      const emailMatches = [...emails.entries()]
        .filter(([, email]) => email.startsWith(qLower))
        .map(([id]) => id)
        .slice(0, 50);
      const orParts = [`username.ilike.%${q}%`, `display_name.ilike.%${q}%`];
      if (emailMatches.length) orParts.push(`id.in.(${emailMatches.join(",")})`);
      const { data, error } = await profileQuery
        .or(orParts.join(","))
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);
      if (error) loadError = error.message;
      profileRows = data ?? [];
    } else {
      const { data, error } = await profileQuery
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);
      if (error) loadError = error.message;
      profileRows = data ?? [];
    }

    // Roles: earliest grant wins, mirroring getAuthedUser(). Scoped to the
    // rows actually being shown to keep the query small.
    const roleByUser = new Map<string, UserRole>();
    const ids = profileRows.map((profile) => profile.id);
    if (ids.length) {
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id, role, granted_at")
        .in("user_id", ids)
        .order("granted_at", { ascending: true });
      if (roleError && !loadError) loadError = roleError.message;
      for (const row of roleRows ?? []) {
        if (!roleByUser.has(row.user_id)) roleByUser.set(row.user_id, row.role);
      }
    }

    // Wallets: RLS only exposes a user's own wallet, so admin reads need the
    // service-role client.
    const balances = new Map<string, number>();
    if (service && ids.length) {
      const { data: walletRows } = await service.from("wallets").select("user_id, balance").in("user_id", ids);
      for (const wallet of walletRows ?? []) balances.set(wallet.user_id, wallet.balance);
    }

    rows = profileRows.map((profile) => ({
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      email: emails.get(profile.id) ?? null,
      isBanned: profile.is_banned,
      createdAt: profile.created_at,
      role: roleByUser.get(profile.id) ?? "member",
      balance: serviceReady ? (balances.get(profile.id) ?? 0) : null,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by username, display name or email prefix — then change roles, ban accounts or
            adjust ARKSOME Coin (AC) balances. Every change is written to the audit log.
          </p>
        </div>
        <form method="get" action="/admin/users" className="flex w-full max-w-md items-center gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search users…"
            aria-label="Search users"
            className="h-9"
          />
          <Button type="submit" size="sm" className="h-9">
            <Search className="size-4" />
            Search
          </Button>
          {q && (
            <Link href="/admin/users" className="text-sm font-medium text-primary hover:underline">
              Clear
            </Link>
          )}
        </form>
      </div>

      {!supabase && (
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>User management becomes available once the project is connected.</AlertDescription>
        </Alert>
      )}

      {supabase && !serviceReady && (
        <Alert variant="warning">
          <AlertTitle>Privileged access unavailable</AlertTitle>
          <AlertDescription>
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> is not set. Wallet balances
            and email addresses cannot be read, and role, ban and balance changes will be rejected
            until it is added to <code className="font-mono">.env.local</code>.
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="error">
          <AlertTitle>Failed to load users</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {emailTruncated && (
        <p className="text-xs text-muted-foreground">
          Email search and display covers the first {EMAIL_PAGES * EMAIL_PAGE_SIZE} accounts.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {!supabase ? (
            <EmptyState message="Connect Supabase to manage users." />
          ) : rows.length === 0 ? (
            <EmptyState
              message={q ? `No users match “${q}”.` : "No users found."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Balance</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.displayName ?? row.username ?? "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.username ? `@${row.username}` : "no username"}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">{row.email ?? "email unavailable"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_BADGE[row.role]}>{row.role.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-coin">
                        {row.balance === null ? (
                          <span className="font-normal text-muted-foreground">unavailable</span>
                        ) : (
                          formatCoins(row.balance)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.isBanned ? (
                          <Badge variant="destructive">Banned</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <UserRowActions
                          userId={row.id}
                          role={row.role}
                          isBanned={row.isBanned}
                          isSelf={row.id === admin.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === PAGE_LIMIT && (
                <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  Showing the first {PAGE_LIMIT} matching users — refine the search to narrow the list.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <UsersRound className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href="/admin/users" className="text-sm font-medium text-primary hover:underline">
        Clear search
      </Link>
    </div>
  );
}
