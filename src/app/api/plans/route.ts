import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { logAuditAction } from '@/lib/audit';

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceCents: 'asc' }
    });
    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    // @ts-ignore
    if (!session || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized (OWNER only)' }, { status: 403 });
    }

    const { name, durationDays, priceCents } = await request.json();

    if (!name || !durationDays || priceCents === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const plan = await prisma.plan.create({
      data: { name, durationDays, priceCents }
    });

    await logAuditAction(session.user.id, 'PLAN_CREATE', 'Plan', plan.id, { name, durationDays, priceCents });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
