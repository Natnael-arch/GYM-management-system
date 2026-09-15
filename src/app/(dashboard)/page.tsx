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
import { Users, Activity, AlertTriangle, ShieldAlert, ChevronRight } from "lucide-react";

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
      <div className="p-5 space-y-5 max-w-5xl mx-auto">

        {/* Stat row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            href="/attendance/today"
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

        {/* Expiring Soon */}
        {expiringSoon.length > 0 && (
          <section className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              <h2 className="text-sm font-semibold">Expiring Soon</h2>
              <span className="ml-auto text-xs text-muted-foreground">{expiringSoon.length} member{expiringSoon.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-border">
              {expiringSoon.map(m => (
                <Link
                  key={m.id}
                  href={`/members/${m.member.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <Avatar name={`${m.member.firstName} ${m.member.lastName}`} className="w-7 h-7 text-xs shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.member.firstName} {m.member.lastName}</p>
                    <p className="text-xs text-muted-foreground">{m.plan.name}</p>
                  </div>
                  <Badge variant="warning" className="shrink-0">
                    <DualDate date={m.endsAt} inline short />
                  </Badge>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Blocked Members */}
        {blockedMembers.length > 0 && (
          <section className="bg-card border border-destructive/30 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
              <h2 className="text-sm font-semibold text-destructive">Blocked Members</h2>
              <span className="ml-auto text-xs text-muted-foreground">{blockedMembers.length} member{blockedMembers.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-border">
              {blockedMembers.map(m => (
                <Link
                  key={m.id}
                  href={`/members/${m.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <Avatar name={`${m.firstName} ${m.lastName}`} className="w-7 h-7 text-xs shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.firstName} {m.lastName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.barcode}</p>
                  </div>
                  <Badge variant="danger" className="shrink-0">Blocked</Badge>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* All clear state */}
        {expiringSoon.length === 0 && blockedMembers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">All clear — no expiring memberships or blocked members.</p>
        )}

      </div>
    </>
  );
}
