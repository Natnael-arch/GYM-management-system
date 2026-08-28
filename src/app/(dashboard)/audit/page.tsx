import { prisma } from "@/lib/prisma";
import { requireRole } from '@/lib/auth-helpers';
import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/DataTable";
import { Badge, BadgeVariant } from "@/components/ui/Badge";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const session = await requireRole(['OWNER']);
  if (!session) return redirect('/');

  const resolvedParams = await searchParams;
  const actionFilter = resolvedParams.action;

  const where = actionFilter ? { action: actionFilter } : {};

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { name: true, email: true }
      }
    },
    take: 100
  });

  const getActionBadge = (action: string): BadgeVariant => {
    if (action.includes('CREATE') || action.includes('ISSUE')) return 'success';
    if (action.includes('UPDATE')) return 'action-update';
    if (action.includes('DELETE') || action.includes('BLOCKED')) return 'danger';
    return 'neutral';
  };

  return (
    <>
      <TopBar 
        title="Audit Logs" 
        subtitle="Recent administrative actions (Owner only)" 
        action={
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Link href="/audit" className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!actionFilter ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>All</Link>
            <Link href="/audit?action=MEMBER_UPDATE" className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${actionFilter === 'MEMBER_UPDATE' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Updates</Link>
            <Link href="/audit?action=MEMBERSHIP_ISSUE" className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${actionFilter === 'MEMBERSHIP_ISSUE' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Memberships</Link>
            <Link href="/audit?action=PAYMENT_RECORDED" className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${actionFilter === 'PAYMENT_RECORDED' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Payments</Link>
          </div>
        }
      />
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No logs found.</TableCell>
              </TableRow>
            ) : logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                </TableCell>
                <TableCell className="font-medium">
                  {log.user.name || log.user.email}
                </TableCell>
                <TableCell>
                  <Badge variant={getActionBadge(log.action)}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.entityType} <span className="font-mono text-xs opacity-50">#{log.entityId.slice(-6)}</span>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-xs md:max-w-md">
                  <div className="truncate" title={log.details || ''}>
                    {log.details || '-'}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
