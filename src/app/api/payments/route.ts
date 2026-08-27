import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAuditAction } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const staffId = session.user.id;

    const { membershipId, amountCents, method } = await request.json();

    if (!membershipId || amountCents === undefined || !method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const payment = await prisma.payment.create({
      data: {
        membershipId,
        amountCents,
        method,
        recordedById: staffId
      }
    });

    await logAuditAction(staffId, 'PAYMENT_RECORDED', 'Payment', payment.id, { amountCents, method, membershipId });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
