import Link from "next/link";
import { SITE_NAME, COIN_DISCLAIMER, TAGLINE } from "@/lib/constants";

const columns = [
  {
    title: "Platform",
    links: [
      { href: "/", label: "Discovery feed" },
      { href: "/activities", label: "Activities" },
      { href: "/referrals", label: "Referrals" },
      { href: "/about", label: "About" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/cookies", label: "Cookie policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span className="brand-gradient grid size-8 place-items-center rounded-lg text-sm font-bold text-white">
              A
            </span>
            {SITE_NAME}
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">{TAGLINE}</p>
          <p className="mt-4 max-w-sm rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
            {COIN_DISCLAIMER}
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold">{column.title}</h3>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {SITE_NAME}. ARKSOME Coins are internal platform points with
        no cash value.
      </div>
    </footer>
  );
}
