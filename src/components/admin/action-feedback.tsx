"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FeedbackState } from "./use-admin-action";

/** Inline success/error message rendered below admin forms. */
export function ActionFeedback({ feedback }: { feedback: FeedbackState }) {
  if (!feedback) return null;
  return (
    <Alert variant={feedback.kind === "success" ? "success" : "error"} className="mt-3">
      <AlertDescription>{feedback.text}</AlertDescription>
    </Alert>
  );
}
