"use client";

import { useActionState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SettingsState } from "@/app/(app)/settings/actions";

const THEME_KEY = "arksome-theme";

/**
 * Light/dark switch for the Appearance card. Toggles the `dark` class on
 * <html> and persists the choice to localStorage["arksome-theme"], which the
 * pre-paint script in the root layout reads on the next load. The current mode
 * is reflected through Tailwind's `dark:` variant, so no client state is
 * needed and server/client markup always match.
 */
export function ThemeToggle() {
  function toggleTheme() {
    const isDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch {
      // Storage may be blocked (private mode); the toggle still applies.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">Dark mode</p>
        <p className="text-xs text-muted-foreground">
          Saved in your browser and applied to this device.
        </p>
      </div>
      <Button variant="outline" onClick={toggleTheme}>
        <Sun className="size-4 dark:hidden" aria-hidden />
        <Moon className="size-4 hidden dark:inline" aria-hidden />
        Toggle theme
      </Button>
    </div>
  );
}

/**
 * Client wrapper for the settings forms: posts to a server action and renders
 * the `{ ok, error, message }` state it returns as visible text.
 */
export function SettingsForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(action, {
    ok: false,
  });

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}
      {children}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
