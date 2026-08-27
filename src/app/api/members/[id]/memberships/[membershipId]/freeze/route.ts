import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAuditAction } from '@/lib/audit';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string, membershipId: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { membershipId } = await params;
    const { freeze } = await request.json(); // boolean true = freeze, false = unfreeze

    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: freeze ? 'FROZEN' : 'ACTIVE'
      }
    });

    await logAuditAction(session.user.id, freeze ? 'MEMBERSHIP_FREEZE' : 'MEMBERSHIP_UNFREEZE', 'Membership', membershipId);

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
