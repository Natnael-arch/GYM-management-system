import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveMembershipQuery } from '@/lib/membership-utils';
import { toZonedTime } from 'date-fns-tz';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const gymCurrentTime = toZonedTime(new Date(), 'Africa/Addis_Ababa');
    
    // Fetch all members with their memberships to derive active status
    const members = await prisma.member.findMany({
      select: {
        id: true,
        barcode: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        isBlocked: true,
        memberships: {
          where: getActiveMembershipQuery(gymCurrentTime),
          take: 1
        }
      }
    });

    const offlineManifest = members.map(m => ({
      id: m.id,
      barcode: m.barcode,
      name: `${m.firstName} ${m.lastName}`,
      photoUrl: m.photoUrl,
      isBlocked: m.isBlocked,
      isActive: m.memberships.length > 0
    }));

    return NextResponse.json(offlineManifest);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
