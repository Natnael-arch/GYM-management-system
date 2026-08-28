import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';

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
        data: { deviceUserId: null }
      });

      // Map to the new member
      await prisma.member.update({
        where: { id: memberId },
        data: { deviceUserId }
      });
      
      await logAuditAction(session.user.id, 'BIOMETRIC_MAP', 'Member', memberId, `Mapped to device user ${deviceUserId}`);
    } else {
      // Unmap completely
      const existing = await prisma.member.findUnique({ where: { deviceUserId } });
      if (existing) {
        await prisma.member.update({
          where: { id: existing.id },
          data: { deviceUserId: null }
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
