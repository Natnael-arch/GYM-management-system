import { NextResponse } from 'next/server';
import { zktecoService } from '@/lib/zkteco';
import { requireRole } from '@/lib/auth-helpers';

export async function GET() {
  const session = await requireRole(['OWNER', 'STAFF']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [diag, info] = await Promise.all([
    zktecoService.diagnose(),
    zktecoService.getInfo().catch((e: unknown) => ({
      error: e instanceof Error ? e.message : String(e),
    })),
  ]);

  return NextResponse.json({
    connected: zktecoService.getStatus(),
    lastError: zktecoService.getLastError(),
    diag,
    info,
  });
}
