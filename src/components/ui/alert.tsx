import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "info" | "success" | "warning" | "error";
};

const styles: Record<NonNullable<Props["variant"]>, string> = {
  info: "border-primary/30 bg-primary/10 text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  warning: "border-accent/40 bg-accent/10 text-foreground",
  error: "border-destructive/30 bg-destructive/10 text-foreground",
};

export function Alert({ variant = "info", className, ...props }: Props) {
  return (
    <div
      role="alert"
      className={cn("rounded-lg border px-4 py-3 text-sm", styles[variant], className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <p className={cn("mb-1 font-medium", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
