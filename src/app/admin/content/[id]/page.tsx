import { notFound } from "next/navigation";
import { ContentForm } from "@/components/admin/content-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Edit content</h1>
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Connect the project before editing content.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { data, error } = await supabase.from("content").select("*").eq("id", id).maybeSingle();

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Edit content</h1>
        <Alert variant="error">
          <AlertTitle>Could not load this content</AlertTitle>
          <AlertDescription>
            {error.message.includes("invalid input syntax")
              ? "That is not a valid content id."
              : error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit content</h1>
        <p className="mt-1 text-sm text-muted-foreground">Editing /{data.slug}</p>
      </div>
      <ContentForm initial={data} />
    </div>
  );
}
