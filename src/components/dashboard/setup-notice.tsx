import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Friendly setup notice rendered instead of crashing when Supabase
 * credentials have not been added to `.env.local` yet.
 */
export function SetupNotice() {
  return (
    <Alert variant="warning">
      <AlertTitle>Supabase is not configured yet</AlertTitle>
      <AlertDescription>
        Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="font-mono">.env.local</code>, run the migrations, then refresh this page
        to see your live data.
      </AlertDescription>
    </Alert>
  );
}
