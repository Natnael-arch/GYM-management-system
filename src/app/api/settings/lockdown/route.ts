import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { logAuditAction } from '@/lib/audit';

export async function GET() {
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    return NextResponse.json({ lockdownMode: settings?.lockdownMode || false });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireRole(['OWNER']);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lockdownMode } = await request.json();

    const updated = await prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: { lockdownMode },
      create: { id: 'default', lockdownMode }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
