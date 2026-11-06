import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";

const MASTER_ADMIN_EMAILS = [
  "admin@nexus.com",
  "lucasmeloil@pm.me"
];

function isMasterEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return MASTER_ADMIN_EMAILS.some(e => e.toLowerCase() === clean);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const cleanEmail = email.trim().toLowerCase();
          
          const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
          if (!user) return null;

          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (passwordsMatch) {
             // Guarantee Master Admin has SUPERADMIN role
             if (isMasterEmail(cleanEmail) && user.role !== "SUPERADMIN") {
               await prisma.user.update({
                 where: { id: user.id },
                 data: { role: "SUPERADMIN" },
               }).catch(() => {});
               user.role = "SUPERADMIN";
             }
             return user;
          }
        }
        return null;
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
});
