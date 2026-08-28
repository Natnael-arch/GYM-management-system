import { NextResponse } from 'next/server';
import { zktecoService } from '@/lib/zkteco';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth'; // Ensure this matches actual auth logic

export async function GET(request: Request) {
  try {
    // Only STAFF+ can view mappings
    const session = await requireRole(['OWNER', 'STAFF']);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch raw users from device
    const deviceUsers = await zktecoService.getUsers();

    // Fetch existing gym members to see who is mapped
    const members = await prisma.member.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        deviceUserId: true,
      }
    });

    const mappedDeviceUserIds = new Set(members.map(m => m.deviceUserId).filter(Boolean));

    // Combine them
    const mapped = [];
    const unmapped = [];

    for (const dUser of deviceUsers) {
      if (mappedDeviceUserIds.has(dUser.userid)) {
        mapped.push(dUser);
      } else {
        unmapped.push(dUser);
      }
    }

    return NextResponse.json({
      connected: zktecoService.getStatus(),
      deviceUsers: { mapped, unmapped },
      members // We pass members so the UI can power a dropdown to select who to map to
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
