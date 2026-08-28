import { prisma } from "@/lib/prisma";
import { getActiveMembershipQuery } from "@/lib/membership-utils";
import { getGymLocalDayDate } from "@/lib/date-utils";
import { toZonedTime } from "date-fns-tz";
import { addDays } from "date-fns";
import Link from "next/link";
import { LockdownControls } from "./LockdownControls";
import { redirect } from "next/navigation";
import { requireRole, hasRole } from '@/lib/auth-helpers';
import { TopBar } from "@/components/layout/TopBar";
import { StatCard } from "@/components/ui/StatCard";
import { DualDate } from "@/components/ui/DualDate";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Users, Activity, AlertTriangle, ShieldAlert } from "lucide-react";

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
    <>
      <TopBar 
        title="Dashboard" 
        subtitle={<DualDate date={gymCurrentTime} inline short />} 
        action={isOwner ? <LockdownControls initialLockdown={settings?.lockdownMode || false} /> : undefined}
      />
      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Active Members" 
            value={activeMembersCount} 
            icon={Users} 
            variant="count" 
          />
          <StatCard 
            title="Checked In Today" 
            value={checkedInTodayCount} 
            icon={Activity} 
            variant="count" 
            subtext="Unique visits"
          />
          <StatCard 
            title="Expiring in 7 Days" 
            value={expiringSoon.length} 
            icon={AlertTriangle} 
            variant="warning" 
          />
          <StatCard 
            title="Blocked Members" 
            value={blockedMembers.length} 
            icon={ShieldAlert} 
            variant="danger" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Expiring Soon
              </h2>
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {expiringSoon.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No memberships expiring soon.
                </div>
              ) : (
                expiringSoon.map(m => (
                  <div key={m.id} className="p-4 hover:bg-muted/50 transition-colors flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <Avatar name={`${m.member.firstName} ${m.member.lastName}`} />
                      <div>
                        <Link href={`/members/${m.member.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                          {m.member.firstName} {m.member.lastName}
                        </Link>
                        <p className="text-sm text-muted-foreground">{m.plan.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="warning">
                        Ends <DualDate date={m.endsAt} inline short />
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-5 h-5" />
                Blocked Members
              </h2>
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {blockedMembers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No blocked members.
                </div>
              ) : (
                blockedMembers.map(m => (
                  <div key={m.id} className="p-4 hover:bg-muted/50 transition-colors flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <Avatar name={`${m.firstName} ${m.lastName}`} />
                      <div>
                        <Link href={`/members/${m.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                          {m.firstName} {m.lastName}
                        </Link>
                        <p className="text-sm text-muted-foreground font-mono">{m.barcode}</p>
                      </div>
                    </div>
                    <Badge variant="danger">Blocked</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
