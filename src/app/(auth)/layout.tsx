import Link from "next/link";
import { SITE_NAME, TAGLINE } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="brand-gradient grid size-8 place-items-center rounded-lg text-sm font-bold text-white">
              A
            </span>
            {SITE_NAME}
          </Link>
          <Link href="/" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            ← Back to the feed
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {children}
          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            {TAGLINE} — ARKSOME Coins are internal platform points with no cash value.
          </p>
        </div>
      </main>
    </div>
  );
}
