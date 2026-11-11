"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, X } from "lucide-react";
import { ActionFeedback } from "./action-feedback";
import { useAdminAction } from "./use-admin-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { adminCreateContent, adminUpdateContent, type ContentInput } from "@/lib/actions/admin";
import type { Content, ContentStatus, ContentType } from "@/lib/database.types";
import { slugify } from "@/lib/utils";
import { MediaUpload } from "./media-upload";

const TYPES: ContentType[] = ["article", "video", "short", "community"];
const STATUSES: ContentStatus[] = ["draft", "pending", "published", "rejected", "removed"];

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="mb-1.5 block">
        {label}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Create/edit form for admin content. Slug auto-follows the title until edited. */
export function ContentForm({ initial }: { initial?: Content }) {
  const router = useRouter();
  const { run, pending, feedback } = useAdminAction();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [type, setType] = useState<ContentType>(initial?.type ?? "article");
  const [status, setStatus] = useState<ContentStatus>(initial?.status ?? "draft");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? "");
  const [duration, setDuration] = useState(initial?.duration_seconds?.toString() ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [sponsored, setSponsored] = useState(initial?.is_sponsored ?? false);
  const [sponsorName, setSponsorName] = useState(initial?.sponsor_name ?? "");

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: ContentInput = {
      title,
      slug,
      type,
      status,
      excerpt: excerpt.trim() || null,
      body: body.trim() || null,
      cover_url: coverUrl.trim() || null,
      video_url: videoUrl.trim() || null,
      duration_seconds: duration.trim() === "" ? null : Number(duration),
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      is_sponsored: sponsored,
      sponsor_name: sponsorName.trim() || null,
    };
    const result = await run(() =>
      initial ? adminUpdateContent(initial.id, payload) : adminCreateContent(payload),
    );
    if (result.ok) router.push("/admin/content");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{initial ? "Edit content" : "New content"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Title" htmlFor="content-title">
              <Input
                id="content-title"
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
                required
                maxLength={200}
                disabled={pending}
                placeholder="Headline"
              />
            </Field>
          </div>

          <Field
            label="Slug"
            htmlFor="content-slug"
            hint="Used in URLs. Auto-filled from the title until you edit it."
          >
            <Input
              id="content-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              required
              maxLength={200}
              disabled={pending}
              placeholder="my-article-slug"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" htmlFor="content-type">
              <Select
                id="content-type"
                value={type}
                onChange={(event) => setType(event.target.value as ContentType)}
                disabled={pending}
              >
                {TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="content-status">
              <Select
                id="content-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as ContentStatus)}
                disabled={pending}
              >
                {STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Excerpt" htmlFor="content-excerpt" hint="Shown in the feed (max 500 characters).">
              <Textarea
                id="content-excerpt"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                maxLength={500}
                rows={2}
                disabled={pending}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Body" htmlFor="content-body" hint="Plain text or Markdown-style content.">
              <Textarea
                id="content-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={12}
                disabled={pending}
                placeholder="Write the full content here…"
              />
            </Field>
          </div>

          <Field label="Cover image URL" htmlFor="content-cover">
            <Input
              id="content-cover"
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              disabled={pending}
              placeholder="https://…"
            />
            <MediaUpload accept="image/jpeg,image/png,image/webp,image/gif" label="Upload cover image" onUploaded={setCoverUrl} />
          </Field>

          <Field label="Video URL" htmlFor="content-video">
            <Input
              id="content-video"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              disabled={pending}
              placeholder="https://…"
            />
            <MediaUpload accept="video/mp4,video/webm" label="Upload video" onUploaded={setVideoUrl} />
          </Field>

          <Field label="Duration (seconds)" htmlFor="content-duration" hint="Video/short length, e.g. 90.">
            <Input
              id="content-duration"
              type="number"
              min={0}
              step={1}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              disabled={pending}
              placeholder="90"
            />
          </Field>

          <Field label="Tags" htmlFor="content-tags" hint="Comma separated, e.g. design, video, news.">
            <Input
              id="content-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              disabled={pending}
              placeholder="design, video"
            />
          </Field>

          <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4 md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={sponsored}
                onChange={(event) => setSponsored(event.target.checked)}
                disabled={pending}
                className="size-4 rounded border-input"
              />
              Sponsored content
            </label>
            {sponsored && (
              <Field
                label="Sponsor name"
                htmlFor="content-sponsor"
                hint="Required — the database rejects sponsored content without a sponsor."
              >
                <Input
                  id="content-sponsor"
                  value={sponsorName}
                  onChange={(event) => setSponsorName(event.target.value)}
                  required
                  maxLength={120}
                  disabled={pending}
                  placeholder="Sponsor Ltd."
                />
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      <ActionFeedback feedback={feedback} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Saving…" : initial ? "Save changes" : "Create content"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.push("/admin/content")}>
          <X className="size-4" />
          Cancel
        </Button>
        <Link href="/admin/content" className="text-sm text-muted-foreground hover:text-foreground">
          Back to list
        </Link>
      </div>
    </form>
  );
}
