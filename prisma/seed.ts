import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@better-auth/utils/password';

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@gym.com';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'password123';
  const hashedPassword = await hashPassword(ownerPassword);

  // 1. Seed OWNER account
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { password: hashedPassword, role: 'OWNER' },
    create: {
      email: ownerEmail,
      name: 'Gym Owner',
      password: hashedPassword,
      role: 'OWNER',
    },
  });
  console.log(`Owner account: ${owner.email}`);

  // Create an Account record for better-auth
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: owner.id } },
    update: { password: hashedPassword, issuer: 'local:credential' },
    create: {
      userId: owner.id,
      providerId: 'credential',
      accountId: owner.id,
      issuer: 'local:credential',
      password: hashedPassword,
    },
  });

  // 2. Remove any leftover demo / test data (safe to run on clean DB too)
  const junkBarcodes = [
    'MEMBER_ACTIVE', 'MEMBER_EXPIRED', 'MEMBER_BLOCKED', 'MEMBER_NONE',
    'ACTIVE123', 'EXPIRED123', 'BLOCKED123', 'RACE123',
    'LOCKDOWN123', 'FREEZE123', 'BOUND123',
  ];
  await prisma.attendance.deleteMany({ where: { member: { barcode: { in: junkBarcodes } } } });
  await prisma.deniedAttempt.deleteMany({ where: { barcode: { in: junkBarcodes } } });
  await prisma.membership.deleteMany({ where: { member: { barcode: { in: junkBarcodes } } } });
  await prisma.member.deleteMany({ where: { barcode: { in: junkBarcodes } } });

  // 3. Seed default membership plans (idempotent - safe to re-run)
  const defaultPlans = [
    { name: 'Daily Pass',     durationDays: 1,   priceCents: 10000   },
    { name: 'Weekly Plan',    durationDays: 7,   priceCents: 50000   },
    { name: 'Monthly Plan',   durationDays: 30,  priceCents: 150000  },
    { name: 'Quarterly Plan', durationDays: 90,  priceCents: 400000  },
    { name: 'Annual Plan',    durationDays: 365, priceCents: 1400000 },
  ];

  for (const plan of defaultPlans) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.plan.create({ data: plan });
      console.log(`Plan created: ${plan.name}`);
    }
  }

  // 4. Ensure SystemSettings row exists
  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', lockdownMode: false },
  });

  console.log('\nProduction seed complete. No demo data. System ready for handover.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
