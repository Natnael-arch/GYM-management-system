import { prisma } from '@/lib/prisma';
import { getGymLocalDayDate } from '@/lib/date-utils';
import { toZonedTime } from 'date-fns-tz';
import { getActiveMembershipQuery } from '@/lib/membership-utils';
import { globalEmitter } from '@/lib/event-emitter';

const GRACE_PERIOD_MS = 5000;
const graceCache = new Map<string, { timestamp: number; payload: any }>();

export async function processCheckIn(barcode: string, method: string = 'BARCODE') {
  const emit = (payload: any) => {
    globalEmitter.emit('scan', { ...payload, method });
    return payload;
  };

  // 1. Lockdown Check
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
  if (settings?.lockdownMode) {
    await prisma.deniedAttempt.create({
      data: { barcode, reason: 'GYM_CLOSED' }
    });
    return emit({ allowed: false, reason: 'GYM_CLOSED', status: 403, barcode });
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
    return emit({ allowed: false, reason: 'UNKNOWN_ID', status: 404, barcode });
  }

  const memberId = member.id;
  const memberInfo = {
    name: `${member.firstName} ${member.lastName}`,
    photoUrl: member.photoUrl,
    membershipEndsAt: member.memberships[0]?.endsAt || null
  };

  const now = Date.now();
  const cached = graceCache.get(memberId);
  if (cached && (now - cached.timestamp < GRACE_PERIOD_MS)) {
    return emit(cached.payload);
  }

  // 3. Check if blocked
  if (member.isBlocked) {
    await prisma.deniedAttempt.create({
      data: { barcode, memberId, reason: 'BLOCKED' }
    });
    return emit({ allowed: false, reason: 'BLOCKED', status: 403, member: memberInfo });
  }

  // 4. Check active membership
  if (member.memberships.length === 0) {
    await prisma.deniedAttempt.create({
      data: { barcode, memberId, reason: 'MEMBERSHIP_EXPIRED' }
    });
    return emit({ allowed: false, reason: 'MEMBERSHIP_EXPIRED', status: 403, member: memberInfo });
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

    const payload = {
      allowed: true,
      checkedInAt: attendance.checkInAt,
      member: memberInfo,
      status: 200
    };

    graceCache.set(memberId, { timestamp: now, payload });
    return emit(payload);
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('checkInDate')) {
      await prisma.deniedAttempt.create({
        data: { barcode, memberId, reason: 'ALREADY_CHECKED_IN' }
      });
      return emit({ allowed: false, reason: 'ALREADY_CHECKED_IN', status: 409, member: memberInfo });
    }
    throw error;
  }
}
