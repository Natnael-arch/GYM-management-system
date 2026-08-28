import { prisma } from "@/lib/prisma";
import { getActiveMembershipQuery } from "@/lib/membership-utils";
import { getGymLocalDayDate } from "@/lib/date-utils";
import { toZonedTime } from "date-fns-tz";
import { addDays, format } from "date-fns";
import Link from "next/link";
import { LockdownControls } from "./LockdownControls";
import { redirect } from "next/navigation";
import { requireRole, hasRole } from '@/lib/auth-helpers';

export default async function DashboardPage() {
  const session = await requireRole(['OWNER', 'STAFF']);
  if (!session) return redirect('/login');

  const isOwner = hasRole(session, ['OWNER']);

  const gymCurrentTime = toZonedTime(new Date(), 'Africa/Addis_Ababa');
  const checkInDate = getGymLocalDayDate();
  const nextWeek = addDays(gymCurrentTime, 7);

  const [activeMembersCount, checkedInTodayCount, expiringSoon, blockedMembers, settings] = await Promise.all([
    prisma.member.count({
      where: {
        memberships: {
          some: getActiveMembershipQuery(gymCurrentTime)
        }
      }
    }),
    prisma.attendance.count({
      where: { checkInDate }
    }),
    prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { gte: gymCurrentTime, lte: nextWeek }
      },
      include: { member: true, plan: true },
      orderBy: { endsAt: 'asc' }
    }),
    prisma.member.findMany({
      where: { isBlocked: true },
      orderBy: { firstName: 'asc' }
    }),
    prisma.systemSettings.findUnique({ where: { id: 'default' } })
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gym Access Dashboard</h1>
          <p className="text-gray-500 mt-1">{format(gymCurrentTime, "EEEE, MMMM do, yyyy")}</p>
        </div>
        {isOwner && <LockdownControls initialLockdown={settings?.lockdownMode || false} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Members</h3>
          <p className="text-4xl font-bold text-gray-900 mt-2">{activeMembersCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Checked In Today</h3>
          <p className="text-4xl font-bold text-blue-600 mt-2">{checkedInTodayCount}</p>
          <Link href="/attendance/today" className="text-sm text-blue-600 hover:underline mt-2 inline-block">View list &rarr;</Link>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Expiring in 7 Days</h3>
          <p className="text-4xl font-bold text-orange-500 mt-2">{expiringSoon.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Blocked Members</h3>
          <p className="text-4xl font-bold text-red-600 mt-2">{blockedMembers.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Expiring Soon</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {expiringSoon.length === 0 ? (
              <p className="p-6 text-gray-500">No memberships expiring soon.</p>
            ) : (
              expiringSoon.map(m => (
                <div key={m.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
                  <div>
                    <Link href={`/members/${m.member.id}`} className="font-medium text-blue-700 hover:underline">
                      {m.member.firstName} {m.member.lastName}
                    </Link>
                    <p className="text-sm text-gray-500">{m.plan.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600">
                      Ends {format(new Date(m.endsAt), "MMM d")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900 text-red-700">Blocked Members</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {blockedMembers.length === 0 ? (
              <p className="p-6 text-gray-500">No blocked members.</p>
            ) : (
              blockedMembers.map(m => (
                <div key={m.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
                  <div>
                    <Link href={`/members/${m.id}`} className="font-medium text-blue-700 hover:underline">
                      {m.firstName} {m.lastName}
                    </Link>
                    <p className="text-sm text-gray-500 font-mono">{m.barcode}</p>
                  </div>
                  <Link href={`/members/${m.id}/edit`} className="text-sm bg-gray-100 px-3 py-1 rounded border hover:bg-gray-200">
                    Manage
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
