import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Sparkles } from "lucide-react";
import { fetchContentBySlug } from "@/lib/feed";
import { DEMO_CONTENT } from "@/lib/demo-content";
import { getAuthedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { claimContentRead } from "@/lib/actions/rewards";
import { BookmarkButton } from "@/components/bookmark-button";
import { ReportForm } from "@/components/content/report-form";
import { VideoEmbed } from "@/components/feed/video-embed";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function ContentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await fetchContentBySlug(slug);
  if (!result) notFound();
  const item = result.item;
  const user = await getAuthedUser();
  const supabase = await createClient();

  let bookmarked = false;
  if (user && supabase) {
    const { data } = await supabase.from("bookmarks").select("id").eq("user_id", user.id).eq("content_id", item.id).maybeSingle();
    bookmarked = Boolean(data);
  }

  let rewardMessage: string | null = null;
  if (user && isSupabaseConfigured && !item.id.startsWith("demo-")) {
    try {
      const reward = await claimContentRead(item.id);
      if (reward.ok && !reward.duplicate && reward.amount) rewardMessage = `+${reward.amount} AC added for discovering this post.`;
    } catch {
      // Reading content must never fail because the optional discovery reward failed.
    }
  }

  if (isSupabaseConfigured && !item.id.startsWith("demo-")) {
    const service = getServiceClient();
    if (service) {
      const { data } = await service.from("content").select("view_count").eq("id", item.id).maybeSingle();
      if (data) await service.from("content").update({ view_count: data.view_count + 1 }).eq("id", item.id);
    }
  }

  const upNext = supabase
    ? (await supabase.from("content").select("id, slug, type, title, excerpt, cover_url, video_url, duration_seconds, is_sponsored, sponsor_name, tags, published_at, view_count").eq("status", "published").neq("slug", slug).order("published_at", { ascending: false }).limit(3)).data ?? []
    : DEMO_CONTENT.filter((content) => content.slug !== slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {item.is_sponsored && (
        <Alert variant="warning" className="mb-6">
          <p className="font-semibold">Sponsored content</p>
          <p className="mt-1 text-sm text-muted-foreground">Published by {item.sponsor_name ?? "a disclosed partner"}. Sponsorship does not change our editorial labelling.</p>
        </Alert>
      )}

      <article>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{item.type}</Badge>
          {item.is_sponsored && <Badge variant="sponsored"><Sparkles className="size-3" /> Sponsored</Badge>}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Eye className="size-3.5" /> {item.view_count.toLocaleString()} views</span>
        </div>
        <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-5xl">{item.title}</h1>
        {item.excerpt && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{item.excerpt}</p>}
        <p className="mt-4 text-sm text-muted-foreground">{item.published_at ? new Date(item.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Recently published"}</p>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          {item.video_url ? <VideoEmbed src={item.video_url} poster={item.cover_url} title={item.title} duration={item.duration_seconds} /> : item.cover_url ? <div className="relative aspect-video"><Image src={item.cover_url} alt="" fill priority sizes="(max-width: 768px) 100vw, 896px" className="object-cover" /></div> : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-border pb-5">
          {user && <BookmarkButton contentId={item.id} initialBookmarked={bookmarked} />}
          {user && <ReportForm contentId={item.id} />}
          {rewardMessage && <span className="rounded-full bg-coin/20 px-3 py-1 text-xs font-semibold text-[#92400e]">{rewardMessage}</span>}
        </div>

        <div className="prose prose-neutral mt-8 max-w-none text-base leading-8 dark:prose-invert">
          {(item.body ?? "There is no written description for this post yet.").split(/\n\n+/).map((paragraph, index) => (
            <p key={index}>{paragraph.split("\n").map((line, lineIndex) => <span key={lineIndex}>{line}{lineIndex < paragraph.split("\n").length - 1 && <br />}</span>)}</p>
          ))}
        </div>

        {item.tags.length > 0 && <div className="mt-8 flex flex-wrap gap-2">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">#{tag}</span>)}</div>}
      </article>

      <section className="mt-14 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">Up next</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {upNext.map((next) => <Link key={next.id} href={`/content/${next.slug}`} className="overflow-hidden rounded-lg border border-border bg-card hover:border-primary"><div className="relative aspect-video bg-muted">{next.cover_url && <Image src={next.cover_url} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />}</div><div className="p-3"><p className="text-sm font-semibold leading-snug">{next.title}</p><p className="mt-1 text-xs text-muted-foreground">{next.type}</p></div></Link>)}
        </div>
      </section>
    </div>
  );
}
