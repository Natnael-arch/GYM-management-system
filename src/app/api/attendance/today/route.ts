import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGymLocalDayDate } from '@/lib/date-utils';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const checkInDate = getGymLocalDayDate();

    const attendance = await prisma.attendance.findMany({
      where: {
        checkInDate: checkInDate
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            barcode: true
          }
        }
      },
      orderBy: {
        checkInAt: 'desc'
      }
    });

    return NextResponse.json({
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
