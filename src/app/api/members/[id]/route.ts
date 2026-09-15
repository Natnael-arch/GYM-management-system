import { writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, hasRole } from '@/lib/auth-helpers';
import { logAuditAction } from '@/lib/audit';
import { syncMemberAccess } from '@/lib/device-sync';

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
  const deviceUserId = formData.get('deviceUserId') as string | null;

  const updateData: any = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (phone !== null) updateData.phone = phone;
  if (deviceUserId !== null) {
    updateData.deviceUserId = deviceUserId ? deviceUserId : null;
    updateData.biometricEnrolled = !!deviceUserId;
  }

  if (photo && photo.size > 0) {
    const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Photo must be under 5 MB' }, { status: 400 });
    }
    if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
      return NextResponse.json({ error: 'Photo must be JPEG, PNG, or WebP' }, { status: 400 });
    }

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
    if (isArchived !== null) {
      updateData.isArchived = isArchived === 'true';
      // Archiving removes them from the device — clear the slot in DB too
      // so the PIN is free to be reused and the biometric state is truthful.
      if (updateData.isArchived) {
        updateData.biometricEnrolled = false;
        updateData.deviceUserId = null;
      }
    }
  } else if (isBlocked !== null || isArchived !== null) {
    return NextResponse.json({ error: 'Forbidden: Only OWNER can block or archive members' }, { status: 403 });
  }

  try {
    const member = await prisma.member.update({
      where: { id },
      data: updateData,
    });

    const auditAction = updateData.isArchived === true
      ? 'MEMBER_ARCHIVE'
      : updateData.isBlocked === true
        ? 'MEMBER_BLOCK'
        : updateData.isBlocked === false
          ? 'MEMBER_UNBLOCK'
          : 'MEMBER_UPDATE';

    await logAuditAction(session.user.id, auditAction, 'Member', id, updateData);

    // Sync device: removes fingerprint from device when archived or blocked.
    syncMemberAccess(id).catch((err) =>
      console.error('[DeviceSync] member PATCH sync error:', err)
    );

    return NextResponse.json(member);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

