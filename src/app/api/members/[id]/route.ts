import { writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, hasRole } from '@/lib/auth-helpers';
import { logAuditAction } from '@/lib/audit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireRole(['OWNER', 'STAFF']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          plan: true,
          payments: true
        },
        orderBy: { startsAt: 'desc' }
      }
    }
  });

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json(member);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireRole(['OWNER', 'STAFF']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const phone = formData.get('phone') as string;
  const photo = formData.get('photo') as File | null;
  const isBlocked = formData.get('isBlocked') as string | null;
  const isArchived = formData.get('isArchived') as string | null;

  const updateData: any = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (phone !== null) updateData.phone = phone;

  if (photo && photo.size > 0) {
    const bytes = await photo.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${photo.name}`;
    const filepath = path.join(process.cwd(), 'public/uploads', filename);
    await writeFile(filepath, buffer);
    updateData.photoUrl = `/uploads/${filename}`;
  }

  // Only OWNER can block/archive
  if (hasRole(session, ['OWNER'])) {
    if (isBlocked !== null) updateData.isBlocked = isBlocked === 'true';
    if (isArchived !== null) updateData.isArchived = isArchived === 'true';
  } else if (isBlocked !== null || isArchived !== null) {
    return NextResponse.json({ error: 'Forbidden: Only OWNER can block or archive members' }, { status: 403 });
  }

  try {
    const member = await prisma.member.update({
      where: { id },
      data: updateData,
    });
    await logAuditAction(session.user.id, 'MEMBER_UPDATE', 'Member', id, updateData);
    return NextResponse.json(member);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
