"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { memberSubmitTask } from "@/lib/actions/tasks";
import type { TaskActionResult } from "@/lib/actions/tasks";

export function SubmitTaskButton({ taskId, disabled = false }: { taskId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TaskActionResult | null>(null);

  return (
    <div>
      <Button disabled={disabled || pending} onClick={() => startTransition(async () => setResult(await memberSubmitTask(taskId)))}>
        {pending ? "Submitting…" : "Mark as Complete"}
      </Button>
      {result && <p role="status" className={`mt-2 text-sm ${result.ok ? "text-success" : "text-destructive"}`}>{result.message ?? result.error}</p>}
    </div>
  );
}
