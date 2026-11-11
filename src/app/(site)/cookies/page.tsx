import { LegalPage } from "@/components/content/legal-page";

export const metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return <LegalPage title="Cookie Policy" updated="11 November 2026">
    <section><h2>What cookies are</h2><p>Cookies are small files stored by a website. ARKSOME uses the minimum storage needed to provide a secure, usable service.</p></section>
    <section><h2>What ARKSOME uses</h2><ul className="list-disc space-y-2 pl-5"><li><strong className="text-foreground">Authentication:</strong> Supabase session cookies keep you signed in and let the server apply your permissions.</li><li><strong className="text-foreground">Preferences:</strong> your selected light/dark theme is stored in localStorage in your browser.</li><li><strong className="text-foreground">Security:</strong> short-lived technical information may be used to rate-limit sensitive actions and detect abuse.</li></ul></section>
    <section><h2>Advertising cookies</h2><p>Advertising cookies and similar technologies are not enabled in this initial implementation. If we introduce them, we will provide appropriate notice, obtain consent where required, and use only approved provider integrations. Rewarded advertising will remain optional.</p></section>
    <section><h2>Managing storage</h2><p>You can clear cookies and local storage through your browser settings. Clearing authentication cookies will sign you out; clearing the theme preference returns the interface to its default or system preference. Blocking all cookies may prevent sign-in from working.</p></section>
    <section><h2>More information</h2><p>For how we handle personal data, read the <a href="/privacy">privacy policy</a>. Questions can be sent to <a href="mailto:privacy@arksome.example">privacy@arksome.example</a>.</p></section>
  </LegalPage>;
}
