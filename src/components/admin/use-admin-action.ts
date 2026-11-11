"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export type FeedbackState = { kind: "success" | "error"; text: string } | null;

/** Structural mirror of AdminActionResult (type-only, avoids importing from
 * a "use server" module into client code). */
type ActionResult = { ok: boolean; error?: string; message?: string };

/**
 * Small wrapper around admin server actions: tracks pending state, surfaces
 * the `{ ok, error?, message? }` result and refreshes the server-rendered
 * admin page so changed data appears without a manual reload.
 */
export function useAdminAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const run = useCallback(
    async (action: () => Promise<ActionResult>): Promise<ActionResult> => {
      setPending(true);
      setFeedback(null);
      try {
        const result = await action();
        if (result.ok) {
          setFeedback({ kind: "success", text: result.message ?? "Saved." });
          router.refresh();
        } else {
          setFeedback({ kind: "error", text: result.error ?? "Something went wrong." });
        }
        return result;
      } catch (err) {
        const text = err instanceof Error ? err.message : "Unexpected error.";
        setFeedback({ kind: "error", text });
        return { ok: false, error: text };
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending, feedback };
}
