import Link from "next/link";
import { Coins, Compass, HeartHandshake } from "lucide-react";
import { COIN_DISCLAIMER } from "@/lib/constants";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "About" };

export default function AboutPage() {
  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <p className="text-sm font-semibold uppercase tracking-wider text-primary">About ARKSOME</p>
    <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">A better reason to keep scrolling.</h1>
    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">ARKSOME is a content-discovery platform for curious people. Find useful ideas, entertaining short videos and community stories, then choose whether to complete simple activities for internal platform points.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      {[
        [Compass, "Discover", "Explore a feed built around useful, interesting and clearly-labelled content."],
        [HeartHandshake, "Choose", "Activities and rewarded opportunities are optional. Basic browsing never depends on ads."],
        [Coins, "Get rewarded", "Earn ARKSOME Coins (AC) for eligible actions, with transparent rules and limits."],
      ].map(([Icon, title, text]) => <div key={title as string} className="rounded-xl border border-border bg-card p-5"><Icon className="size-6 text-primary" /><h2 className="mt-4 font-semibold">{title as string}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text as string}</p></div>)}
    </div>
    <Alert variant="warning" className="mt-8"><p className="font-semibold">Important about ARKSOME Coins</p><p className="mt-1 text-sm">{COIN_DISCLAIMER}</p></Alert>
    <section className="mt-10"><h2 className="text-2xl font-semibold">Our product principles</h2><ul className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">{["Content comes first, even without ads.", "Rewards are voluntary and clearly explained.", "Balances are honest and validated on the server.", "We do not reward clicks, refreshes or artificial engagement.", "Sponsored content is labelled clearly.", "Privacy, security and moderation are built into the platform."].map((item) => <li key={item} className="rounded-lg bg-muted p-4">{item}</li>)}</ul></section>
    <section className="mt-10 rounded-xl border border-border bg-card p-6"><h2 className="text-xl font-semibold">What AC is not</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">ARKSOME Coins are not money, cryptocurrency, income, an investment, a guaranteed return, a withdrawal balance or a transferable user-to-user asset. They exist only for eligible features inside ARKSOME.</p><Link href="/terms" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Read the full terms →</Link></section>
  </div>;
}
