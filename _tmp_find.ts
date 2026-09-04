import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

p.member.findFirst({
  where: {
    OR: [
      { firstName: { contains: "kebede", mode: "insensitive" } },
      { lastName: { contains: "elias", mode: "insensitive" } }
    ]
  },
  include: { memberships: { where: { status: "ACTIVE" }, take: 1 } }
}).then(m => {
  console.log("Found:", JSON.stringify(m, null, 2));
  return p.$disconnect();
});

