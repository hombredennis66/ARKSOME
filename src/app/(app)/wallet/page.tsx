import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { COIN_DISCLAIMER } from "@/lib/constants";
import { cn, formatCoins, formatDate, formatNumber, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SetupNotice } from "@/components/dashboard/setup-notice";
import type { CoinTransaction } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  if (!supabase) return <SetupNotice />;

  const user = await requireUser("/wallet");
  const { page: pageParam } = await searchParams;
  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Count first so the page can be clamped before fetching the window.
  const countRes = await supabase
    .from("coin_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const total = countRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(safePage, totalPages);

  const { data } = await supabase
    .from("coin_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const transactions: CoinTransaction[] = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Wallet</h1>
        <p className="mt-1 text-muted-foreground">
          Your balance and the full, permanent history of every AC movement.
        </p>
      </div>

      {/* Balance + disclaimer */}
      <section aria-labelledby="balance-heading" className="rounded-2xl border border-border bg-card p-6">
        <p id="balance-heading" className="text-sm font-medium text-muted-foreground">
          Current balance
        </p>
        <p className="mt-2 text-4xl font-bold text-coin">{formatCoins(user.balance)}</p>
        <p className="mt-4 max-w-3xl rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          {COIN_DISCLAIMER}
        </p>
      </section>

      {/* Ledger */}
      <section aria-labelledby="history-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="history-heading" className="text-lg font-semibold">
            Transaction history
          </h2>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `${formatNumber(total)} transaction${total === 1 ? "" : "s"}`
              : "No transactions yet"}
          </p>
        </div>

        {total === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-medium">No transactions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete an activity and your first AC credit will appear here.
            </p>
            <Link
              href="/activities"
              className={cn(buttonVariants({ variant: "default" }), "mt-4")}
            >
              Browse activities
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Reason
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Source
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <time dateTime={tx.created_at} className="block">
                          {formatDate(tx.created_at)}
                        </time>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(tx.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{tx.reason}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {capitalize(tx.source)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={tx.type === "credit" ? "success" : "destructive"}>
                          {tx.type === "credit" ? "Credit" : "Debit"}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-3 text-right font-semibold",
                          tx.type === "credit" ? "text-success" : "text-destructive",
                        )}
                      >
                        {tx.type === "credit" ? "+" : "−"}
                        {formatCoins(tx.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-coin">
                        {formatCoins(tx.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav
                className="mt-4 flex flex-wrap items-center justify-between gap-3"
                aria-label="Transaction pages"
              >
                {page > 1 ? (
                  <Link
                    href={page - 1 > 1 ? `/wallet?page=${page - 1}` : "/wallet"}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "pointer-events-none opacity-50",
                    )}
                  >
                    ← Previous
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={`/wallet?page=${page + 1}`} className={buttonVariants({ variant: "outline" })}>
                    Next →
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "pointer-events-none opacity-50",
                    )}
                  >
                    Next →
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
