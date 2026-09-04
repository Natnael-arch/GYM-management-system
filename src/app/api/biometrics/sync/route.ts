import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { reconcileAllMembers } from '@/lib/device-sync';

/**
 * POST /api/biometrics/sync
 * Manually trigger a full device reconciliation (OWNER only).
 * Removes any device users whose membership has expired or who are blocked.
 */
export async function POST() {
  const session = await requireRole(['OWNER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await reconcileAllMembers();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reconciliation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
