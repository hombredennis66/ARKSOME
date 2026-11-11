"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

/** Save/remove a content item from the signed-in member's bookmarks. */
export async function toggleBookmark(contentId: string): Promise<{ ok: boolean; bookmarked: boolean; error?: string }> {
  const user = await requireUser("/bookmarks");
  const supabase = await createClient();
  if (!supabase) return { ok: false, bookmarked: false, error: "Supabase is not configured." };

  const { data: existing } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("content_id", contentId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("bookmarks").delete().eq("id", existing.id);
    if (error) return { ok: false, bookmarked: true, error: error.message };
    revalidatePath("/bookmarks");
    revalidatePath("/");
    return { ok: true, bookmarked: false };
  }

  const { error } = await supabase.from("bookmarks").insert({ user_id: user.id, content_id: contentId });
  if (error) return { ok: false, bookmarked: false, error: error.message };

  revalidatePath("/bookmarks");
  revalidatePath("/");
  return { ok: true, bookmarked: true };
}

/** Remove one bookmark by content id (used by the saved list). */
export async function removeBookmark(contentId: string): Promise<{ ok: boolean }> {
  const user = await requireUser("/bookmarks");
  const supabase = await createClient();
  if (!supabase) return { ok: false };

  await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("content_id", contentId);
  revalidatePath("/bookmarks");
  return { ok: true };
}
