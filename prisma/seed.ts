import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const prisma = new PrismaClient();
const TIMEZONE = 'Africa/Addis_Ababa';

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@gym.com';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'password123';
  const hashedPassword = await bcrypt.hash(ownerPassword, 10);

  // 1. Seed OWNER account
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      name: 'Gym Owner',
      password: hashedPassword,
      role: 'OWNER',
    },
  });
  console.log(`Owner created: ${owner.email}`);

  // Create an Account record for better-auth
  await prisma.account.upsert({
    where: {
      providerId_accountId: { providerId: 'credential', accountId: owner.id },
    },
    update: {},
    create: {
      userId: owner.id,
      providerId: 'credential',
      accountId: owner.id,
      password: hashedPassword,
    },
  });

  // Create Plans
  const monthlyPlan = await prisma.plan.create({
    data: {
      name: 'Monthly Plan',
      durationDays: 30,
      priceCents: 5000,
    },
  });

  // 2. Active member
  const activeMember = await prisma.member.create({
    data: {
      barcode: 'MEMBER_ACTIVE',
      firstName: 'Alice',
      lastName: 'Active',
      memberships: {
        create: {
          planId: monthlyPlan.id,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
        },
      },
    },
  });

  // 3. Expired member
  const expiredMember = await prisma.member.create({
    data: {
      barcode: 'MEMBER_EXPIRED',
      firstName: 'Bob',
      lastName: 'Expired',
      memberships: {
        create: {
          planId: monthlyPlan.id,
          startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          endsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          status: 'EXPIRED',
        },
      },
    },
  });

  // 4. Blocked member
  const blockedMember = await prisma.member.create({
    data: {
      barcode: 'MEMBER_BLOCKED',
      firstName: 'Charlie',
      lastName: 'Blocked',
      isBlocked: true,
      memberships: {
        create: {
          planId: monthlyPlan.id,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
        },
      },
    },
  });

  // 5. Member with no membership
  const noneMember = await prisma.member.create({
    data: {
      barcode: 'MEMBER_NONE',
      firstName: 'Dave',
      lastName: 'NoMembership',
    },
  });

  // 6. Backdated Attendance for active member (1 week)
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const checkInTime = subDays(now, i);
    // Africa/Addis_Ababa timezone date string parsing/formatting
    const dateStr = formatInTimeZone(checkInTime, TIMEZONE, 'yyyy-MM-dd');
    const localDayStart = new Date(`${dateStr}T00:00:00Z`);

    await prisma.attendance.create({
      data: {
        memberId: activeMember.id,
        checkInAt: checkInTime,
        checkInDate: localDayStart,
        method: 'BARCODE',
      },
    });
  }

  console.log('Seeding complete! Created members:', activeMember.id, expiredMember.id, blockedMember.id, noneMember.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
