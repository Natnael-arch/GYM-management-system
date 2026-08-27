import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAuditAction } from '@/lib/audit';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    // @ts-ignore
    if (!session || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized (OWNER only)' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.plan.delete({
      where: { id }
    });

    await logAuditAction(session.user.id, 'PLAN_DELETE', 'Plan', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error (Plan may be in use)' }, { status: 500 });
  }
}
