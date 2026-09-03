import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { headers } from "next/headers";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "STAFF"
      }
    }
  },
  session: {
    expiresIn: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60 * 2, // 2 hours
  },
  emailAndPassword: {
    enabled: true,
  },
});

