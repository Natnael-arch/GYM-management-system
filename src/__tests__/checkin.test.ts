import { test, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST as checkInPost } from '@/app/api/check-in/route';
import { getGymLocalDayDate } from '@/lib/date-utils';

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

afterAll(async () => {
  await prisma.$disconnect();
});

test('Check-in Decision Tree', async () => {
  // 1. UNKNOWN_ID
  let req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST',
    body: JSON.stringify({ barcode: 'NONEXISTENT' })
  });
  let res = await checkInPost(req);
  let data = await res.json();
  expect(res.status).toBe(404);
  expect(data.allowed).toBe(false);
  expect(data.reason).toBe('UNKNOWN_ID');

  // Create members for other paths
  const blockedMember = await prisma.member.create({
    data: { firstName: 'Blocked', lastName: 'Member', barcode: 'BLOCKED123', isBlocked: true }
  });

  const expiredMember = await prisma.member.create({
    data: { firstName: 'Expired', lastName: 'Member', barcode: 'EXPIRED123' }
  });
  await prisma.membership.create({
    data: {
      memberId: expiredMember.id,
      planId: (await prisma.plan.create({ data: { name: 'Test Plan', durationDays: 30, priceCents: 1000 } })).id,
      startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Ended 30 days ago
      status: 'EXPIRED'
    }
  });

  const activeMember = await prisma.member.create({
    data: { firstName: 'Active', lastName: 'Member', barcode: 'ACTIVE123' }
  });
  await prisma.membership.create({
    data: {
      memberId: activeMember.id,
      planId: (await prisma.plan.findFirst())!.id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Ends in 30 days
      status: 'ACTIVE'
    }
  });

  // 2. BLOCKED
  req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST',
    body: JSON.stringify({ barcode: 'BLOCKED123' })
  });
  res = await checkInPost(req);
  data = await res.json();
  expect(res.status).toBe(403);
  expect(data.reason).toBe('BLOCKED');

  // 3. EXPIRED
  req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST',
    body: JSON.stringify({ barcode: 'EXPIRED123' })
  });
  res = await checkInPost(req);
  data = await res.json();
  expect(res.status).toBe(403);
  expect(data.reason).toBe('MEMBERSHIP_EXPIRED');

  // 4. ALLOW & GRACE WINDOW
  req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST',
    body: JSON.stringify({ barcode: 'ACTIVE123' })
  });
  res = await checkInPost(req);
  data = await res.json();
  expect(res.status).toBe(200);
  expect(data.allowed).toBe(true);

  // 5. Grace Window Cache (Immediate re-scan)
  let res2 = await checkInPost(new Request('http://localhost:3000/api/check-in', {
    method: 'POST',
    body: JSON.stringify({ barcode: 'ACTIVE123' })
  }));
  let data2 = await res2.json();
  expect(res2.status).toBe(200); // Uses cache, returns 200, no duplicate insert error
  expect(data2.allowed).toBe(true);

  // 6. Race Condition (Direct DB bypass of grace window to simulate exact same time or different node)
  // We will manually try to insert another attendance for today to see the DB unique constraint throw correctly
  try {
    await prisma.attendance.create({
      data: { memberId: activeMember.id, checkInDate: getGymLocalDayDate(), method: 'BARCODE' }
    });
    expect(true).toBe(false); // Should not reach here
  } catch (e: any) {
    expect(e.code).toBe('P2002');
  }

  // Cleanup
  await prisma.deniedAttempt.deleteMany({
    where: { barcode: { in: ['NONEXISTENT', 'BLOCKED123', 'EXPIRED123', 'ACTIVE123'] } }
  });
  await prisma.attendance.deleteMany({ where: { memberId: activeMember.id } });
  await prisma.membership.deleteMany({ where: { memberId: { in: [expiredMember.id, activeMember.id] } } });
  await prisma.member.deleteMany({ where: { id: { in: [blockedMember.id, expiredMember.id, activeMember.id] } } });
});

test('Race condition via concurrent API calls', async () => {
  // Test that two parallel calls handle unique constraints correctly.
  // To avoid the grace window cache, we'll hit the manual endpoint or clear the cache, 
  // but since cache is module scoped, we can just use two different active members or mock date.
  const activeMember = await prisma.member.create({
    data: { firstName: 'Race', lastName: 'Condition', barcode: 'RACE123' }
  });
  await prisma.membership.create({
    data: {
      memberId: activeMember.id,
      planId: (await prisma.plan.findFirst())!.id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Ends in 30 days
      status: 'ACTIVE'
    }
  });

  // To truly hit a race, we might need to bypass the in-memory cache.
  // Actually, wait, the in-memory cache is populated synchronously? 
  // No, `graceCache.set` is called AFTER `prisma.attendance.create` finishes.
  // So two simultaneous requests (Promise.all) will both bypass the `graceCache.get` check
  // because it hasn't been set yet, and both will attempt `prisma.attendance.create`.
  // The DB will allow one and throw P2002 for the other!
  
  const req1 = new Request('http://localhost:3000/api/check-in', {
    method: 'POST', body: JSON.stringify({ barcode: 'RACE123' })
  });
  const req2 = new Request('http://localhost:3000/api/check-in', {
    method: 'POST', body: JSON.stringify({ barcode: 'RACE123' })
  });

  const [res1, res2] = await Promise.all([checkInPost(req1), checkInPost(req2)]);
  const statuses = [res1.status, res2.status].sort();

  // One should be 200 (Success), one should be 409 (Conflict - ALREADY_CHECKED_IN)
  expect(statuses).toEqual([200, 409]);

  // Cleanup
  await prisma.deniedAttempt.deleteMany({ where: { barcode: 'RACE123' } });
  await prisma.attendance.deleteMany({ where: { memberId: activeMember.id } });
  await prisma.membership.deleteMany({ where: { memberId: activeMember.id } });
  await prisma.member.deleteMany({ where: { id: activeMember.id } });
});

test('Expiry Boundary Test', async () => {
  const member = await prisma.member.create({
    data: { firstName: 'Boundary', lastName: 'Member', barcode: 'BOUND123' }
  });
  
  const plan = await prisma.plan.findFirst();
  const gymCurrentTime = getGymLocalDayDate(); // midnight today
  
  // Create a membership that ended exactly 1 millisecond before gym current time
  const expiredMembership = await prisma.membership.create({
    data: {
      memberId: member.id,
      planId: plan!.id,
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(gymCurrentTime.getTime() - 1),
      status: 'ACTIVE' // Stored as active, but effectively expired
    }
  });

  const req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST', body: JSON.stringify({ barcode: 'BOUND123' })
  });
  const res = await checkInPost(req);
  const data = await res.json();
  
  // It should fail because endsAt < gymCurrentTime
  expect(res.status).toBe(403);
  expect(data.reason).toBe('MEMBERSHIP_EXPIRED');

  // Cleanup
  await prisma.deniedAttempt.deleteMany({ where: { barcode: 'BOUND123' } });
  await prisma.membership.delete({ where: { id: expiredMembership.id } });
  await prisma.member.delete({ where: { id: member.id } });
});

test('Freeze Integration Test', async () => {
  const member = await prisma.member.create({
    data: { firstName: 'Freeze', lastName: 'Test', barcode: 'FREEZE123' }
  });
  
  const activeMembership = await prisma.membership.create({
    data: {
      memberId: member.id,
      planId: (await prisma.plan.findFirst())!.id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'FROZEN' // Explicitly frozen
    }
  });

  let req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST', body: JSON.stringify({ barcode: 'FREEZE123' })
  });
  let res = await checkInPost(req);
  let data = await res.json();
  
  expect(res.status).toBe(403);
  expect(data.reason).toBe('MEMBERSHIP_EXPIRED'); // the checkin API translates "no active membership found" to MEMBERSHIP_EXPIRED

  // Unfreeze
  await prisma.membership.update({
    where: { id: activeMembership.id },
    data: { status: 'ACTIVE' }
  });

  req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST', body: JSON.stringify({ barcode: 'FREEZE123' })
  });
  res = await checkInPost(req);
  data = await res.json();
  
  expect(res.status).toBe(200);
  expect(data.allowed).toBe(true);

  // Cleanup
  await prisma.deniedAttempt.deleteMany({ where: { barcode: 'FREEZE123' } });
  await prisma.attendance.deleteMany({ where: { memberId: member.id } });
  await prisma.membership.delete({ where: { id: activeMembership.id } });
  await prisma.member.delete({ where: { id: member.id } });
});

test('Lockdown Mode Integration Test', async () => {
  // 1. Enable Lockdown
  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: { lockdownMode: true },
    create: { id: 'default', lockdownMode: true }
  });

  const member = await prisma.member.create({
    data: { firstName: 'Lockdown', lastName: 'Member', barcode: 'LOCKDOWN123' }
  });
  
  await prisma.membership.create({
    data: {
      memberId: member.id,
      planId: (await prisma.plan.findFirst())!.id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE'
    }
  });

  // Check-in should fail with GYM_CLOSED
  let req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST', body: JSON.stringify({ barcode: 'LOCKDOWN123' })
  });
  let res = await checkInPost(req);
  let data = await res.json();
  
  expect(res.status).toBe(403);
  expect(data.reason).toBe('GYM_CLOSED');

  // 2. Disable Lockdown
  await prisma.systemSettings.update({
    where: { id: 'default' },
    data: { lockdownMode: false }
  });

  // Check-in should succeed now
  req = new Request('http://localhost:3000/api/check-in', {
    method: 'POST', body: JSON.stringify({ barcode: 'LOCKDOWN123' })
  });
  res = await checkInPost(req);
  data = await res.json();
  
  expect(res.status).toBe(200);
  expect(data.allowed).toBe(true);

  // Cleanup
  await prisma.deniedAttempt.deleteMany({ where: { barcode: 'LOCKDOWN123' } });
  await prisma.attendance.deleteMany({ where: { memberId: member.id } });
  await prisma.membership.deleteMany({ where: { memberId: member.id } });
  await prisma.member.delete({ where: { id: member.id } });
});
