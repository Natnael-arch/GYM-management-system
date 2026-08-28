import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/DataTable";
import { DualDate } from "@/components/ui/DualDate";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { CreditCard, DollarSign } from "lucide-react";
import Link from "next/link";
import { requireRole } from '@/lib/auth-helpers';
import { redirect } from "next/navigation";

export default async function PaymentsPage() {
  const session = await requireRole(['OWNER', 'STAFF']);
  if (!session) return redirect('/login');

  const payments = await prisma.payment.findMany({
    include: {
      membership: {
        include: {
          member: true,
          plan: true,
        }
      },
      recordedBy: true
    },
    orderBy: { paidAt: 'desc' },
    take: 100
  });

  const totalRevenue = payments.reduce((acc, p) => acc + p.amountCents, 0);

  return (
    <>
      <TopBar title="Payments" subtitle="Recent transactions" />
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Revenue (Recent)" 
            value={`${(totalRevenue / 100).toFixed(2)} ETB`} 
            icon={DollarSign} 
            variant="money" 
          />
          <StatCard 
            title="Transactions" 
            value={payments.length} 
            icon={CreditCard} 
            variant="count" 
          />
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
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
                    No recent payments.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      <DualDate date={payment.paidAt} includeTime short />
                    </TableCell>
                    <TableCell>
                      <Link href={`/members/${payment.membership.memberId}`} className="hover:text-primary transition-colors">
                        {payment.membership.member.firstName} {payment.membership.member.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.membership.plan.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{payment.method}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {payment.recordedBy.name || payment.recordedBy.email}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {(payment.amountCents / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
