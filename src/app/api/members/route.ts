import { writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { generateBarcodeToken } from '@/lib/generate-barcode';
import { headers } from 'next/headers';
import { logAuditAction } from '@/lib/audit';

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const isBlocked = url.searchParams.get('isBlocked');
  const isArchived = url.searchParams.get('isArchived');

  const where: any = {
    ...(isBlocked ? { isBlocked: isBlocked === 'true' } : {}),
    ...(isArchived ? { isArchived: isArchived === 'true' } : { isArchived: false }), // default to non-archived
  };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const members = await prisma.member.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      memberships: {
        where: { endsAt: { gte: new Date() }, status: 'ACTIVE' },
        take: 1
      }
    }
  });

  return NextResponse.json(members);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const phone = formData.get('phone') as string;
  const photo = formData.get('photo') as File | null;
  const deviceUserId = (formData.get('deviceUserId') as string) || null;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  if (photo && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Photo must be under 5 MB' }, { status: 400 });
    }
    if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
      return NextResponse.json({ error: 'Photo must be JPEG, PNG, or WebP' }, { status: 400 });
    }
  }

  let photoUrl = null;
  if (photo && photo.size > 0) {
    const bytes = await photo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${photo.name}`;
    const filepath = path.join(process.cwd(), 'public/uploads', filename);
    await writeFile(filepath, buffer);
    photoUrl = `/uploads/${filename}`;
  }

  // Retry logic for unique barcode collision
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    const barcode = generateBarcodeToken();
    try {
      const member = await prisma.member.create({
        data: {
          firstName,
          lastName,
          phone,
          photoUrl,
          barcode,
          deviceUserId: deviceUserId || undefined,
          biometricEnrolled: !!deviceUserId,
        },
      });
      await logAuditAction(session.user.id, 'MEMBER_CREATE', 'Member', member.id, { firstName, lastName, deviceUserId });
      return NextResponse.json(member, { status: 201 });
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
