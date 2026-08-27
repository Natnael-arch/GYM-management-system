import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGymLocalDayDate } from '@/lib/date-utils';
import { toZonedTime } from 'date-fns-tz';
import { getActiveMembershipQuery } from '@/lib/membership-utils';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAuditAction } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const memberId = body.memberId;

    if (!memberId) {
      return NextResponse.json({ allowed: false, reason: 'INVALID_INPUT' }, { status: 400 });
    }

    const checkInDate = getGymLocalDayDate();
    const gymCurrentTime = toZonedTime(new Date(), 'Africa/Addis_Ababa');

    // 1. Lookup member
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        memberships: {
          where: getActiveMembershipQuery(gymCurrentTime),
          take: 1
        }
      }
    });

    if (!member) {
      return NextResponse.json({ allowed: false, reason: 'UNKNOWN_ID' }, { status: 404 });
    }

    // 2. Check if blocked
    if (member.isBlocked) {
      await prisma.deniedAttempt.create({
        data: { barcode: member.barcode, memberId, reason: 'BLOCKED (MANUAL)' }
      });
      return NextResponse.json({ allowed: false, reason: 'BLOCKED' }, { status: 403 });
    }

    // 3. Check active membership
    if (member.memberships.length === 0) {
      await prisma.deniedAttempt.create({
        data: { barcode: member.barcode, memberId, reason: 'MEMBERSHIP_EXPIRED (MANUAL)' }
      });
      return NextResponse.json({ allowed: false, reason: 'MEMBERSHIP_EXPIRED' }, { status: 403 });
    }

    // 4. Insert Attendance
    try {
      const attendance = await prisma.attendance.create({
        data: {
          memberId,
          checkInDate,
          method: 'MANUAL'
        }
      });

      await logAuditAction(session.user.id, 'MANUAL_CHECKIN', 'Member', memberId);

      return NextResponse.json({
        allowed: true,
        checkedInAt: attendance.checkInAt,
        member: {
          name: `${member.firstName} ${member.lastName}`,
          photoUrl: member.photoUrl,
          membershipEndsAt: member.memberships[0].endsAt
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('checkInDate')) {
        await prisma.deniedAttempt.create({
          data: { barcode: member.barcode, memberId, reason: 'ALREADY_CHECKED_IN (MANUAL)' }
        });
        return NextResponse.json({ allowed: false, reason: 'ALREADY_CHECKED_IN' }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ allowed: false, reason: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
