import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const memberId = searchParams.get('memberId');

    if (!fromParam || !toParam) {
      return NextResponse.json({ error: 'Missing from or to parameters' }, { status: 400 });
    }

    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);

    const where: any = {
      checkInDate: {
        gte: fromDate,
        lte: toDate
      }
    };

    if (memberId) {
      where.memberId = memberId;
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        checkInAt: 'asc'
      }
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
