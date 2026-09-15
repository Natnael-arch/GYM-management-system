import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/DataTable";
import { DualDate } from "@/components/ui/DualDate";
import { Badge } from "@/components/ui/Badge";
import { CreditCard, Banknote, Building2, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { toZonedTime } from "date-fns-tz";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

const TZ = "Africa/Addis_Ababa";
const PAGE_SIZE = 50;

const PERIODS = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All",
} as const;
type Period = keyof typeof PERIODS;

function getPeriodStart(period: Period, now: Date): Date | undefined {
  if (period === "today") return startOfDay(now);
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(now);
  return undefined;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; page?: string }>;
}) {
  const session = await requireRole(["OWNER", "STAFF"]);
  if (!session) return redirect("/login");

  const { period: rawPeriod, page: rawPage } = await searchParams;
  const period: Period = (rawPeriod as Period) in PERIODS ? (rawPeriod as Period) : "today";
  const page = Math.max(1, parseInt(rawPage || "1", 10));

  const gymNow = toZonedTime(new Date(), TZ);
  const since = getPeriodStart(period, gymNow);

  const where = since ? { paidAt: { gte: since } } : undefined;

  const [total, payments, summary] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        membership: { include: { member: true, plan: true } },
        recordedBy: true,
      },
      orderBy: { paidAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where,
      _sum: { amountCents: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalCents = summary.reduce((s, g) => s + (g._sum.amountCents ?? 0), 0);
  const byMethod = (m: string) => summary.find((g) => g.method === m)?._sum.amountCents ?? 0;

  const fmt = (cents: number) => (cents / 100).toFixed(2);

  const periodLink = (p: Period) => `/payments?period=${p}`;
  const pageLink = (p: number) => `/payments?period=${period}&page=${p}`;

  return (
    <>
      <TopBar title="Payments" subtitle={PERIODS[period]} />
      <div className="p-5 max-w-5xl mx-auto space-y-5">

        {/* Period filter */}
        <div className="flex gap-1">
          {(Object.entries(PERIODS) as [Period, string][]).map(([key, label]) => (
            <Link
              key={key}
              href={periodLink(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                period === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: TrendingUp, label: "Total", cents: totalCents, color: "text-primary" },
            { icon: Banknote, label: "Cash", cents: byMethod("CASH"), color: "text-success" },
            { icon: Building2, label: "Bank", cents: byMethod("BANK"), color: "text-primary" },
            { icon: CreditCard, label: "Card", cents: byMethod("CARD"), color: "text-muted-foreground" },
          ].map(({ icon: Icon, label, cents, color }) => (
            <div key={label} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
              <Icon className={`w-4 h-4 shrink-0 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold tabular-nums">
                  {fmt(cents)} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Ledger */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead className="text-right">Amount (ETB)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No payments in this period.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      <DualDate date={payment.paidAt} includeTime short />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/members/${payment.membership.memberId}`}
                        className="hover:text-primary transition-colors text-sm"
                      >
                        {payment.membership.member.firstName} {payment.membership.member.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {payment.membership.plan.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{payment.method}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {payment.recordedBy.name || payment.recordedBy.email}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {fmt(payment.amountCents)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Link
              href={pageLink(page - 1)}
              className={`flex items-center gap-1 px-2 py-1 border border-input rounded hover:bg-muted transition-colors ${page === 1 ? "pointer-events-none opacity-40" : ""}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Link>
            <span>
              Page {page} of {totalPages} · {total} transaction{total !== 1 ? "s" : ""}
            </span>
            <Link
              href={pageLink(page + 1)}
              className={`flex items-center gap-1 px-2 py-1 border border-input rounded hover:bg-muted transition-colors ${page === totalPages ? "pointer-events-none opacity-40" : ""}`}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

      </div>
    </>
  );
}
