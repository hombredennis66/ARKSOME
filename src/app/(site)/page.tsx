import Link from "next/link";
import { Coins, Gift, PlayCircle, ShieldCheck, Sparkles } from "lucide-react";
import { fetchFeed } from "@/lib/feed";
import { getAuthedUser } from "@/lib/auth";
import { FeedList } from "@/components/feed/feed-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { COIN_DISCLAIMER, SITE_NAME, TAGLINE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const [feed, user] = await Promise.all([fetchFeed({}), getAuthedUser()]);
  const { ref } = await searchParams;

  let bookmarkedIds: string[] = [];
  if (user) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase.from("bookmarks").select("content_id").eq("user_id", user.id);
      bookmarkedIds = (data ?? []).map((b) => b.content_id);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {feed.demo && (
        <Alert variant="warning" className="mb-6">
          <AlertTitle>Preview mode</AlertTitle>
          <AlertDescription>
            Supabase is not configured yet, so this feed is showing built-in demo content. Add your
            project keys to <code className="font-mono">.env.local</code> and run the migrations to
            go live.
          </AlertDescription>
        </Alert>
      )}

      {ref && (
        <Alert className="mb-6">
          <AlertTitle>Referral code received</AlertTitle>
          <AlertDescription>
            Create your account and the referral will be attributed automatically.
          </AlertDescription>
        </Alert>
      )}

      <section className="mb-8 grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">{SITE_NAME}</p>
          <h1 className="text-balance mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{TAGLINE}</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Scroll a feed worth scrolling — articles, short videos and community picks — and earn
            ARKSOME Coins for the activities you choose to complete. No ads to click, no cash
            promises, no tricks.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={user ? "/activities" : "/register"}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Gift className="size-4" />
              {user ? "Open activities" : "Create a free account"}
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 font-medium hover:bg-muted"
            >
              <ShieldCheck className="size-4" />
              How rewards work
            </Link>
          </div>
        </div>

        <ul className="grid gap-3 self-center">
          {[
            { icon: Sparkles, title: "Discover", text: "A clean, fast, mobile-first feed." },
            { icon: PlayCircle, title: "Watch & learn", text: "Short videos, quizzes and activities." },
            { icon: Coins, title: "Get rewarded", text: "Earn AC for optional actions you choose." },
          ].map((feature) => (
            <li key={feature.title} className="flex items-start gap-3 rounded-lg bg-muted p-3">
              <feature.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{feature.title}</p>
                <p className="text-sm text-muted-foreground">{feature.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <FeedList
          initialItems={feed.items}
          initialCursor={feed.nextCursor}
          bookmarkedIds={bookmarkedIds}
          canSave={Boolean(user)}
        />

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Your balance</h2>
              <p className="mt-2 text-2xl font-bold text-coin">
                {user ? `${user.balance.toLocaleString()} AC` : "— AC"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {user ? "Earn more by completing activities." : "Sign in to see your balance."}
              </p>
              <Link
                href={user ? "/wallet" : "/login"}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                {user ? "View transaction history →" : "Sign in →"}
              </Link>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Ways to earn</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>• Daily check-in</li>
                <li>• Quizzes and challenges</li>
                <li>• Content discovery</li>
                <li>• Streak milestones</li>
                <li>• Referring a friend</li>
              </ul>
              <Link href="/activities" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                See all activities →
              </Link>
            </div>

            <p className="rounded-xl border border-border bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
              {COIN_DISCLAIMER}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
