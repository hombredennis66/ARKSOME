"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function MediaUpload({
  accept,
  label,
  onUploaded,
}: {
  accept: string;
  label: string;
  onUploaded: (url: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    if (file.size > 50 * 1024 * 1024) {
      setMessage("Files must be 50 MiB or smaller.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase is not configured yet.");
      return;
    }

    setPending(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sign in again before uploading media.");

      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const path = `${userData.user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("content-media").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from("content-media").getPublicUrl(path);
      onUploaded(data.publicUrl);
      setMessage("Uploaded. The URL field has been filled in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {pending ? "Uploading…" : label}
        <input type="file" accept={accept} className="sr-only" disabled={pending} onChange={(event) => void upload(event.target.files?.[0])} />
      </label>
      {message && <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{message}</p>}
    </div>
  );
}
