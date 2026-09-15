import { NextResponse } from 'next/server';
import { zktecoService } from '@/lib/zkteco';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { logAuditAction } from '@/lib/audit';
import { syncMemberAccess } from '@/lib/device-sync';

export async function POST(request: Request) {
  try {
    const session = await requireRole(['OWNER', 'STAFF']);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { deviceUserId, name, memberId } = body;

    if (!deviceUserId) {
      return NextResponse.json({ error: 'deviceUserId is required' }, { status: 400 });
    }

    const pin = String(deviceUserId).trim();
    if (!/^[\w-]{1,24}$/.test(pin)) {
      return NextResponse.json({ error: 'deviceUserId must be 1-24 chars (letters/digits/_/-)' }, { status: 400 });
    }

    console.log(`[Biometrics API] Starting fingerprint enrollment for PIN ${pin}...`);
    const enrollResult = await zktecoService.enrollUser(pin, name || `Member ${pin}`);

    if (!enrollResult.success) {
      const offline = /connect|reach|timeout|timed out|busy|refused/i.test(enrollResult.error || '');
      return NextResponse.json(
        {
          error: enrollResult.error || 'Enrollment timed out or failed on device',
        },
        { status: offline ? 503 : 500 },
      );
    }

    // If memberId is provided, map it immediately
    if (memberId) {
      await prisma.member.updateMany({
        where: { deviceUserId: pin },
        data: { deviceUserId: null, biometricEnrolled: false }
      });

      await prisma.member.update({
        where: { id: memberId },
        data: { 
          deviceUserId: pin,
          biometricEnrolled: true,
          biometricRef: enrollResult.template || null
        }
      });

      await logAuditAction(session.user.id, 'BIOMETRIC_ENROLL', 'Member', memberId, `Enrolled fingerprint to device user ${pin}`);

      // Immediately enforce access rules: if member has no active membership,
      // remove them from the device so the finger scan is rejected until they pay.
      const syncResult = await syncMemberAccess(memberId);
      console.log(`[Biometrics API] Post-enroll sync for member ${memberId}:`, syncResult);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Fingerprint enrolled successfully',
      deviceUserId: pin
    });
  } catch (err: any) {
    console.error('[Biometrics API] Enroll error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}