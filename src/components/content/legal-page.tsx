import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><p className="text-sm font-semibold uppercase tracking-wider text-primary">ARKSOME</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p><div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_a]:text-primary [&_a]:underline">{children}</div></div>;
}
