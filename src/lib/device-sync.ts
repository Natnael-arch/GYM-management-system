/**
 * device-sync.ts
 *
 * Single source of truth for ZKTeco device <-> DB access control sync.
 *
 * Rules:
 *   - A member is ALLOWED on device iff:
 *       - NOT isBlocked
 *       - NOT isArchived
 *       - Has at least one ACTIVE membership with endsAt >= now
 *       - biometricEnrolled = true (i.e. they have a deviceUserId)
 *
 *   - When a member loses access -> deleteUser from device (finger rejected).
 *   - When a member regains access -> set_user row back (finger still works if
 *     template was preserved by the device; otherwise staff must re-enroll).
 */

import { prisma } from '@/lib/prisma';
import { zktecoService } from '@/lib/zkteco';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Africa/Addis_Ababa';

export type SyncResult =
  | { action: 'removed'; deviceUserId: string }
  | { action: 'restored'; deviceUserId: string }
  | { action: 'skipped'; reason: string }
  | { action: 'error'; error: string };

/**
 * Evaluate a single member's current state and sync the device accordingly.
 * Call this after ANY state change: block, archive, membership issue/renew/freeze/expire.
 */
export async function syncMemberAccess(memberId: string): Promise<SyncResult> {
  const now = toZonedTime(new Date(), TZ);

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      memberships: {
        where: {
          status: 'ACTIVE',
          endsAt: { gte: now },
        },
        take: 1,
      },
    },
  });

  if (!member) return { action: 'skipped', reason: 'Member not found' };
  if (!member.biometricEnrolled || !member.deviceUserId) {
    return { action: 'skipped', reason: 'No biometric enrollment' };
  }

  const deviceUserId = member.deviceUserId;
  const hasActiveAccess =
    !member.isBlocked &&
    !member.isArchived &&
    member.memberships.length > 0;

  if (!hasActiveAccess) {
    console.log(
      `[DeviceSync] Removing device user ${deviceUserId} — blocked=${member.isBlocked} archived=${member.isArchived} activeMembership=${member.memberships.length > 0}`,
    );
    const res = await zktecoService.deleteUser(deviceUserId);
    if (!res.success && !res.note) {
      console.error(`[DeviceSync] Failed to remove ${deviceUserId}:`, res.error);
      return { action: 'error', error: res.error ?? 'Unknown error' };
    }
    return { action: 'removed', deviceUserId };
  } else {
    // Re-add the user row so their finger is accepted again.
    // If their fingerprint template was wiped, staff re-enrolls via biometrics page.
    console.log(`[DeviceSync] Restoring device user ${deviceUserId}`);
    const name = `${member.firstName} ${member.lastName}`;
    const res = await zktecoService.enrollUser(deviceUserId, name);
    if (!res.success) {
      if (res.error && /duplicate|already/i.test(res.error)) {
        return { action: 'restored', deviceUserId };
      }
      console.warn(`[DeviceSync] enrollUser for restore returned:`, res.error);
    }
    return { action: 'restored', deviceUserId };
  }
}

/**
 * Nightly full reconciliation: removes any device users whose DB member
 * no longer has active access (expired, blocked, archived).
 */
export async function reconcileAllMembers(): Promise<{ removed: string[]; errors: string[] }> {
  const now = toZonedTime(new Date(), TZ);
  const removed: string[] = [];
  const errors: string[] = [];

  const members = await prisma.member.findMany({
    where: { biometricEnrolled: true, deviceUserId: { not: null } },
    include: {
      memberships: {
        where: { status: 'ACTIVE', endsAt: { gte: now } },
        take: 1,
      },
    },
  });

  for (const member of members) {
    if (!member.deviceUserId) continue;

    const shouldHaveAccess =
      !member.isBlocked && !member.isArchived && member.memberships.length > 0;

    if (!shouldHaveAccess) {
      console.log(`[DeviceSync Reconcile] Removing ${member.deviceUserId}`);
      const res = await zktecoService.deleteUser(member.deviceUserId);
      if (res.success || res.note) {
        removed.push(member.deviceUserId);
      } else {
        errors.push(`${member.deviceUserId}: ${res.error}`);
      }
    }
  }

  console.log(`[DeviceSync Reconcile] Done. Removed: ${removed.length}, Errors: ${errors.length}`);
  return { removed, errors };
}
