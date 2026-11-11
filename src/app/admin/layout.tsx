import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { requireModerator } from "@/lib/auth";
import { COIN_DISCLAIMER, SITE_NAME } from "@/lib/constants";
import type { UserRole } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<UserRole, string> = {
  member: "Member",
  moderator: "Moderator",
  admin: "Admin",
  super_admin: "Super admin",
};

const ROLE_VARIANT: Record<UserRole, "coin" | "default" | "secondary"> = {
  member: "secondary",
  moderator: "secondary",
  admin: "default",
  super_admin: "coin",
};

/**
 * Admin shell. `requireModerator()` runs first so moderators can reach the
 * moderation queue; each page still applies its narrower server-side role
 * check — hidden links are never the authorization boundary.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireModerator();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="brand-gradient grid size-8 place-items-center rounded-lg text-sm font-bold text-white">
              A
            </span>
            <span className="text-sm">
              {SITE_NAME} <span className="font-normal text-muted-foreground">Admin</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Badge variant={ROLE_VARIANT[user.role]}>
              <ShieldCheck className="size-3" aria-hidden />
              {ROLE_LABEL[user.role]}
            </Badge>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to site
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:grid md:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border md:block">
          <div className="sticky top-14 p-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Console
            </p>
            <AdminNav variant="sidebar" />
            <div className="mt-6 rounded-lg border border-border bg-muted p-3 text-xs">
              <p className="font-medium text-foreground">
                {user.displayName ?? user.username ?? user.email ?? "Operator"}
              </p>
              <p className="mt-1 break-all text-muted-foreground">{user.email ?? "No email on file"}</p>
              <p className="mt-2 text-muted-foreground">
                Signed in as {ROLE_LABEL[user.role].toLowerCase()}.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <nav className="border-b border-border md:hidden" aria-label="Admin sections (mobile)">
            <AdminNav variant="bar" />
          </nav>

          <main className="flex-1 px-4 py-6 sm:px-6 md:px-8">{children}</main>

          <p className="px-4 pb-6 text-center text-[11px] leading-relaxed text-muted-foreground sm:px-6 md:px-8">
            {COIN_DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  );
}
