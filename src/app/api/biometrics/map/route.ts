import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { logAuditAction } from '@/lib/audit';
import { syncMemberAccess } from '@/lib/device-sync';

export async function POST(request: Request) {
  try {
    const session = await requireRole(['OWNER', 'STAFF']);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { deviceUserId, memberId } = body;

    if (!deviceUserId) {
      return NextResponse.json({ error: 'deviceUserId is required' }, { status: 400 });
    }

    if (memberId) {
      // Clear anyone else who might have this deviceUserId first to avoid Unique Constraint errors
      await prisma.member.updateMany({
        where: { deviceUserId },
        data: { deviceUserId: null, biometricEnrolled: false }
      });

      // Map to the new member
      await prisma.member.update({
        where: { id: memberId },
        data: { deviceUserId, biometricEnrolled: true }
      });
      
      await logAuditAction(session.user.id, 'BIOMETRIC_MAP', 'Member', memberId, `Mapped to device user ${deviceUserId}`);

      // Enforce access: remove from device if member has no active membership
      syncMemberAccess(memberId).catch(err =>
        console.error('[DeviceSync] map sync error:', err)
      );
    } else {
      // Unmap completely
      const existing = await prisma.member.findUnique({ where: { deviceUserId } });
      if (existing) {
        await prisma.member.update({
          where: { id: existing.id },
          data: { deviceUserId: null, biometricEnrolled: false }
        });
        await logAuditAction(session.user.id, 'BIOMETRIC_UNMAP', 'Member', existing.id, `Unmapped device user ${deviceUserId}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
