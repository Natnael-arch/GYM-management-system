import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAuditAction } from '@/lib/audit';
import { syncMemberAccess } from '@/lib/device-sync';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string, membershipId: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { membershipId } = await params;
    const { freeze } = await request.json(); // true = freeze, false = unfreeze

    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let updateData: any;

    if (freeze) {
      // Freeze: record the moment it was frozen
      updateData = {
        status: 'FROZEN',
        frozenAt: new Date(),
      };
    } else {
      // Unfreeze: extend endsAt by however long it was frozen, then clear frozenAt
      if (membership.frozenAt) {
        const frozenMs = Date.now() - membership.frozenAt.getTime();
        const newEndsAt = new Date(membership.endsAt.getTime() + frozenMs);
        updateData = {
          status: 'ACTIVE',
          frozenAt: null,
          endsAt: newEndsAt,
        };
      } else {
        // Frozen without a recorded frozenAt (legacy row) — just reactivate, no extension
        updateData = { status: 'ACTIVE', frozenAt: null };
      }
    }

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: updateData,
    });

    await logAuditAction(
      session.user.id,
      freeze ? 'MEMBERSHIP_FREEZE' : 'MEMBERSHIP_UNFREEZE',
      'Membership',
      membershipId,
      freeze ? undefined : { extendedEndsAt: updateData.endsAt?.toISOString() }
    );

    syncMemberAccess(membership.memberId).catch((err) =>
      console.error('[DeviceSync] freeze sync error:', err)
    );

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
