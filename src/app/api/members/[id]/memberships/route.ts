import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getActiveMembershipQuery } from '@/lib/membership-utils';
import { toZonedTime } from 'date-fns-tz';
import { addDays } from 'date-fns';
import { logAuditAction } from '@/lib/audit';
import { syncMemberAccess } from '@/lib/device-sync';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const staffId = session.user.id;
    const { id: memberId } = await params;
    const { planId, paymentAmountCents, paymentMethod } = await request.json();

    if (!planId) return NextResponse.json({ error: 'Plan is required' }, { status: 400 });
    if (!paymentAmountCents || paymentAmountCents <= 0)
      return NextResponse.json({ error: 'Payment amount is required' }, { status: 400 });
    if (!paymentMethod)
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const gymCurrentTime = toZonedTime(new Date(), 'Africa/Addis_Ababa');

    // Find the current active membership to determine start date (renewal chains from its endsAt)
    const activeMembership = await prisma.membership.findFirst({
      where: { memberId, ...getActiveMembershipQuery(gymCurrentTime) },
      orderBy: { endsAt: 'desc' },
    });

    const startsAt = activeMembership ? new Date(activeMembership.endsAt) : gymCurrentTime;
    const endsAt = addDays(startsAt, plan.durationDays);

    const result = await prisma.$transaction(async (tx) => {
      // Mark any stale ACTIVE memberships (endsAt in the past) as EXPIRED
      await tx.membership.updateMany({
        where: {
          memberId,
          status: 'ACTIVE',
          endsAt: { lt: gymCurrentTime },
        },
        data: { status: 'EXPIRED' },
      });

      // Create the new membership
      const membership = await tx.membership.create({
        data: { memberId, planId, startsAt, endsAt, status: 'ACTIVE' },
      });

      // Payment is now required
      await tx.payment.create({
        data: {
          membershipId: membership.id,
          amountCents: paymentAmountCents,
          method: paymentMethod,
          recordedById: staffId,
        },
      });

      return membership;
    });

    await logAuditAction(
      staffId,
      activeMembership ? 'MEMBERSHIP_RENEW' : 'MEMBERSHIP_ISSUE',
      'Membership',
      result.id,
      { planId, paymentAmountCents, paymentMethod }
    );

    syncMemberAccess(memberId).catch((err) =>
      console.error('[DeviceSync] membership POST sync error:', err)
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
