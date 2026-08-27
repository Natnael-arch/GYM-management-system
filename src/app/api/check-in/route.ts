import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGymLocalDayDate } from '@/lib/date-utils';
import { toZonedTime } from 'date-fns-tz';
import { getActiveMembershipQuery } from '@/lib/membership-utils';
import { rateLimit } from '@/lib/rate-limit';

// Simple in-memory cache for the grace window (5 seconds)
// Key: barcode, Value: { timestamp, responsePayload }
const GRACE_PERIOD_MS = 60 * 1000;
const graceCache = new Map<string, { timestamp: number; payload: any }>();

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Rate Limit: Max 2 requests per second per IP
    if (!rateLimit(ip, 2, 1000)) {
      return NextResponse.json({ allowed: false, reason: 'TOO_MANY_REQUESTS' }, { status: 429 });
    }

    const body = await request.json();
    let barcode = body.barcode;

    // 1. Sanitize input
    if (typeof barcode !== 'string') {
      return NextResponse.json({ allowed: false, reason: 'INVALID_INPUT' }, { status: 400 });
    }
    barcode = barcode.trim();
    if (!barcode || !/^[A-Za-z0-9]+$/.test(barcode)) {
      return NextResponse.json({ allowed: false, reason: 'INVALID_INPUT' }, { status: 400 });
    }

    const now = Date.now();

    // 2. Grace Window Check
    const cached = graceCache.get(barcode);
    if (cached && (now - cached.timestamp < GRACE_PERIOD_MS)) {
      return NextResponse.json(cached.payload);
    }

    // Prepare variables for logging
    let memberId: string | null = null;
    const checkInDate = getGymLocalDayDate();
    const gymCurrentTime = toZonedTime(new Date(), 'Africa/Addis_Ababa');

    // 2.5 Lockdown Check
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    if (settings?.lockdownMode) {
      await prisma.deniedAttempt.create({
        data: { barcode, reason: 'GYM_CLOSED' }
      });
      return NextResponse.json({ allowed: false, reason: 'GYM_CLOSED' }, { status: 403 });
    }

    // 3. Lookup member
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
      return NextResponse.json({ allowed: false, reason: 'UNKNOWN_ID' }, { status: 404 });
    }

    memberId = member.id;

    // 4. Check if blocked
    if (member.isBlocked) {
      await prisma.deniedAttempt.create({
        data: { barcode, memberId, reason: 'BLOCKED' }
      });
      return NextResponse.json({ allowed: false, reason: 'BLOCKED' }, { status: 403 });
    }

    // 5. Check active membership
    if (member.memberships.length === 0) {
      await prisma.deniedAttempt.create({
        data: { barcode, memberId, reason: 'MEMBERSHIP_EXPIRED' }
      });
      return NextResponse.json({ allowed: false, reason: 'MEMBERSHIP_EXPIRED' }, { status: 403 });
    }

    // 6. Insert Attendance (ON CONFLICT DO NOTHING handled via try/catch on P2002)
    try {
      const attendance = await prisma.attendance.create({
        data: {
          memberId,
          checkInDate,
          method: 'BARCODE'
        }
      });

      // 7. Success
      const payload = {
        allowed: true,
        checkedInAt: attendance.checkInAt,
        member: {
          name: `${member.firstName} ${member.lastName}`,
          photoUrl: member.photoUrl,
          membershipEndsAt: member.memberships[0].endsAt
        }
      };

      graceCache.set(barcode, { timestamp: now, payload });

      return NextResponse.json(payload);
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('checkInDate')) {
        await prisma.deniedAttempt.create({
          data: { barcode, memberId, reason: 'ALREADY_CHECKED_IN' }
        });
        return NextResponse.json({ allowed: false, reason: 'ALREADY_CHECKED_IN' }, { status: 409 });
      }
      throw error; // Re-throw unexpected DB errors
    }
  } catch (error) {
    return NextResponse.json({ allowed: false, reason: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
