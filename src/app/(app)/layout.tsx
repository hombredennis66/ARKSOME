import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireUser } from "@/lib/auth";
import { MemberNav } from "@/components/member-nav";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { COIN_DISCLAIMER } from "@/lib/constants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Without credentials there is no session to enforce, so show setup
  // instructions instead of bouncing the visitor to an unusable /login.
  const ready = isSupabaseConfigured;
  if (ready) await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      {ready && <MemberNav />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {!ready && <div className="mb-6"><SetupNotice /></div>}
        {children}
      </main>
      <SiteFooter />
      <p className="mx-auto w-full max-w-6xl px-4 pb-6 text-center text-[11px] text-muted-foreground sm:px-6">
        {COIN_DISCLAIMER}
      </p>
    </div>
  );
}
