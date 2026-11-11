"use client";

import { NavLink } from "./nav-link";
import { authedNav } from "@/lib/constants";

export function MemberNav() {
  return (
    <nav
      className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur"
      aria-label="Member areas"
    >
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {authedNav.map((item) => (
          <NavLink key={item.href} href={item.href} className="shrink-0">
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
