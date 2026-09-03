import { NextResponse } from 'next/server';
import { zktecoService } from '@/lib/zkteco';
import { requireRole } from '@/lib/auth-helpers';

export async function GET() {
  const session = await requireRole(['OWNER', 'STAFF']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const logs = await zktecoService.getAttendance();
    return NextResponse.json({ connected: zktecoService.getStatus(), logs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Device unreachable';
    return NextResponse.json({ connected: false, logs: [], error: message });
  }
}
