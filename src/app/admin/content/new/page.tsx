import { ContentForm } from "@/components/admin/content-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewContentPage() {
  await requireAdmin();
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">New content</h1>
        <Alert variant="warning">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Connect the project before creating content.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Draft first, publish when ready. Sponsored items require a sponsor name.
        </p>
      </div>
      <ContentForm />
    </div>
  );
}
