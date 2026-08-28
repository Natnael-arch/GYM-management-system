import { prisma } from '@/lib/prisma';
import { getGymLocalDayDate } from '@/lib/date-utils';
import { toZonedTime } from 'date-fns-tz';
import { getActiveMembershipQuery } from '@/lib/membership-utils';

export async function processCheckIn(barcode: string, method: string = 'BARCODE') {
  // 1. Lockdown Check
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
  if (settings?.lockdownMode) {
    await prisma.deniedAttempt.create({
      data: { barcode, reason: 'GYM_CLOSED' }
    });
    return { allowed: false, reason: 'GYM_CLOSED', status: 403 };
  }

  // 2. Lookup member
  const gymCurrentTime = toZonedTime(new Date(), 'Africa/Addis_Ababa');
  const member = await prisma.member.findUnique({
    where: { barcode },
    include: {
      memberships: {
        where: getActiveMembershipQuery(gymCurrentTime),
        take: 1
      }
    }
  });

  if (!member) {
    await prisma.deniedAttempt.create({
      data: { barcode, reason: 'UNKNOWN_ID' }
    });
    return { allowed: false, reason: 'UNKNOWN_ID', status: 404 };
  }

  const memberId = member.id;

  // 3. Check if blocked
  if (member.isBlocked) {
    await prisma.deniedAttempt.create({
      data: { barcode, memberId, reason: 'BLOCKED' }
    });
    return { allowed: false, reason: 'BLOCKED', status: 403 };
  }

  // 4. Check active membership
  if (member.memberships.length === 0) {
    await prisma.deniedAttempt.create({
      data: { barcode, memberId, reason: 'MEMBERSHIP_EXPIRED' }
    });
    return { allowed: false, reason: 'MEMBERSHIP_EXPIRED', status: 403 };
  }

  // 5. Insert Attendance (ON CONFLICT DO NOTHING handled via try/catch on P2002)
  const checkInDate = getGymLocalDayDate();
  try {
    const attendance = await prisma.attendance.create({
      data: {
        memberId,
        checkInDate,
        method
      }
    });

    return {
      allowed: true,
      checkedInAt: attendance.checkInAt,
      member: {
        name: `${member.firstName} ${member.lastName}`,
        photoUrl: member.photoUrl,
        membershipEndsAt: member.memberships[0].endsAt
      },
      status: 200
    };
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('checkInDate')) {
      await prisma.deniedAttempt.create({
        data: { barcode, memberId, reason: 'ALREADY_CHECKED_IN' }
      });
      return { allowed: false, reason: 'ALREADY_CHECKED_IN', status: 409 };
    }
    throw error;
  }
}
