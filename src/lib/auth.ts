import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgres",
  }),
  session: {
    expiresIn: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60 * 2, // 2 hours
  },
  emailAndPassword: {
    enabled: true,
  },
});
