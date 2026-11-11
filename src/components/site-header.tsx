import Link from "next/link";
import { Coins, LayoutDashboard, LogOut } from "lucide-react";
import { getAuthedUser } from "@/lib/auth";
import { authedNav, publicNav, SITE_NAME } from "@/lib/constants";
import { formatCoins } from "@/lib/utils";
import { signOut } from "@/app/(auth)/actions";
import { NavLink } from "./nav-link";
import { Button } from "./ui/button";

export async function SiteHeader() {
  const user = await getAuthedUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="brand-gradient grid size-8 place-items-center rounded-lg text-sm font-bold text-white">
            A
          </span>
          <span className="text-base">{SITE_NAME}</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
          {user
            ? authedNav.slice(0, 4).map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ))
            : publicNav.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/wallet"
                className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold sm:inline-flex"
                title="ARKSOME Coin balance"
              >
                <Coins className="size-4 text-coin" aria-hidden />
                {formatCoins(user.balance)}
              </Link>

              {(user.role === "admin" || user.role === "super_admin" || user.role === "moderator") && (
                <Link
                  href="/admin"
                  className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground md:inline-flex"
                >
                  <LayoutDashboard className="size-4" /> Admin
                </Link>
              )}

              <Link
                href="/dashboard"
                className="hidden rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 md:inline-block"
              >
                Dashboard
              </Link>

              <form action={signOut}>
                <Button variant="ghost" size="icon" type="submit" title="Sign out" aria-label="Sign out">
                  <LogOut className="size-4" />
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Join free
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav
        className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden"
        aria-label="Mobile"
      >
        {(user ? authedNav : publicNav).map((item) => (
          <NavLink key={item.href} href={item.href} className="shrink-0 text-xs">
            {item.label}
          </NavLink>
        ))}
        {user ? (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-coin/20 px-2 py-1 text-xs font-semibold">
            <Coins className="size-3 text-coin" /> {formatCoins(user.balance)}
          </span>
        ) : null}
      </nav>
    </header>
  );
}
