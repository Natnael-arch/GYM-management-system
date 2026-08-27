import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  const isOwner = (session?.user as any)?.role === 'OWNER';
  if (!isOwner) {
    redirect('/');
  }

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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">Recent administrative actions (Owner only)</p>
        </div>
        <div className="flex gap-2 items-center">
          <Link href="/audit" className={`px-4 py-2 border rounded-md text-sm ${!actionFilter ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}>All</Link>
          <Link href="/audit?action=MEMBER_UPDATE" className={`px-4 py-2 border rounded-md text-sm ${actionFilter === 'MEMBER_UPDATE' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}>Updates</Link>
          <Link href="/audit?action=MEMBERSHIP_ISSUE" className={`px-4 py-2 border rounded-md text-sm ${actionFilter === 'MEMBERSHIP_ISSUE' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}>Memberships</Link>
          <Link href="/audit?action=PAYMENT_RECORDED" className={`px-4 py-2 border rounded-md text-sm ${actionFilter === 'PAYMENT_RECORDED' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}>Payments</Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-600 text-sm">Timestamp</th>
              <th className="px-6 py-4 font-medium text-gray-600 text-sm">Staff</th>
              <th className="px-6 py-4 font-medium text-gray-600 text-sm">Action</th>
              <th className="px-6 py-4 font-medium text-gray-600 text-sm">Entity</th>
              <th className="px-6 py-4 font-medium text-gray-600 text-sm">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No logs found.</td>
              </tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                  {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                </td>
                <td className="px-6 py-4 text-sm font-medium">
                  {log.user.name || log.user.email}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {log.entityType} <span className="text-gray-400 font-mono text-xs">#{log.entityId.slice(-6)}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={log.details || ''}>
                  {log.details || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
