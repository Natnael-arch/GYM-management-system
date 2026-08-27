import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { generateBarcodeToken } from '@/lib/generate-barcode';
import { headers } from 'next/headers';
import { logAuditAction } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    const barcode = generateBarcodeToken();
    try {
      const member = await prisma.member.update({
        where: { id },
        data: { barcode },
      });
      await logAuditAction(session.user.id, 'BARCODE_REGENERATE', 'Member', id);
      return NextResponse.json(member);
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('barcode')) {
        attempts++;
        continue;
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Failed to generate unique barcode' }, { status: 500 });
}
