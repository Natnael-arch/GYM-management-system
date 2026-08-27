import { test, expect, afterAll, beforeAll, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST as createMemberPost } from '@/app/api/members/route';
import { POST as regenerateBarcodePost } from '@/app/api/members/[id]/barcode/route';
import crypto from 'crypto';

// Mock authentication and headers
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: { id: 'test-user', role: 'OWNER', name: 'Test', email: 'test@gym.com' },
        session: { id: 'test-session', userId: 'test-user' }
      })
    }
  }
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockReturnValue(new Headers()),
}));

beforeAll(async () => {
  await prisma.member.deleteMany({
    where: { barcode: 'OLD_BARCODE_456' }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

test('Token uniqueness collision retry logic', async () => {
  const forcedHex = '112233445566'; // valid 12-char hex (6 bytes)
  
  // Create a dummy member with the forced token to cause a collision
  const dummy = await prisma.member.create({
    data: {
      firstName: 'Dummy',
      lastName: 'Collision',
      barcode: forcedHex.toUpperCase(),
    }
  });

  const originalRandomBytes = crypto.randomBytes;
  let callCount = 0;
  
  // Intercept crypto.randomBytes
  vi.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => {
    callCount++;
    if (callCount === 1) return Buffer.from(forcedHex, 'hex');
    return originalRandomBytes(size);
  });

  const formData = new FormData();
  formData.append('firstName', 'Test');
  formData.append('lastName', 'Concurrent');

  const request = new Request('http://localhost:3000/api/members', {
    method: 'POST',
    body: formData,
  });

  const response = await createMemberPost(request);
  const data = await response.json();

  expect(response.status).toBe(201);
  expect(data.barcode).toBeDefined();
  expect(data.barcode).not.toBe(forcedHex.toUpperCase());
  expect(callCount).toBe(2); // Should have retried exactly once!

  // Restore mock
  vi.mocked(crypto.randomBytes).mockRestore();
  
  // Cleanup
  await prisma.member.delete({ where: { id: dummy.id } });
  await prisma.member.delete({ where: { id: data.id } });
});

test('Regenerating token invalidates old token', async () => {
  // Create a member
  const member = await prisma.member.create({
    data: {
      firstName: 'Regen',
      lastName: 'Test',
      barcode: 'OLD_BARCODE_456',
    }
  });

  // Call regenerate endpoint
  const request = new Request(`http://localhost:3000/api/members/${member.id}/barcode`, {
    method: 'POST',
  });

  const response = await regenerateBarcodePost(request, { params: Promise.resolve({ id: member.id }) });
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.barcode).not.toBe('OLD_BARCODE_456');

  // Verify old barcode is invalidated (no longer found)
  const oldFound = await prisma.member.findUnique({ where: { barcode: 'OLD_BARCODE_456' } });
  expect(oldFound).toBeNull();

  // Verify new barcode works
  const newFound = await prisma.member.findUnique({ where: { barcode: data.barcode } });
  expect(newFound?.id).toBe(member.id);

  // Cleanup
  await prisma.member.delete({ where: { id: member.id } });
});
