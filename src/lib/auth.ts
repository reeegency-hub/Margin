import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const password = String(credentials.password);

        const {
          checkRateLimitAsync,
          clientIpFromHeaders,
          LOGIN_EMAIL_LIMIT,
          LOGIN_IP_LIMIT,
          LOGIN_WINDOW_MS,
        } = await import("@/lib/rate-limit");
        const ip = await clientIpFromHeaders();
        const ipLimit = await checkRateLimitAsync(
          `login:ip:${ip}`,
          LOGIN_IP_LIMIT,
          LOGIN_WINDOW_MS
        );
        const emailLimit = await checkRateLimitAsync(
          `login:email:${email}`,
          LOGIN_EMAIL_LIMIT,
          LOGIN_WINDOW_MS
        );
        if (!ipLimit.ok || !emailLimit.ok) {
          const retry = Math.max(
            !ipLimit.ok ? ipLimit.retryAfterSec : 0,
            !emailLimit.ok ? emailLimit.retryAfterSec : 0
          );
          throw new Error(
            `RATE_LIMITED: Trop de tentatives. Réessayez dans ${retry}s.`
          );
        }

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
            include: { restaurant: true },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            /exceeded the data transfer quota|Too Many Requests|P1001|P1002|Can't reach database/i.test(
              msg
            )
          ) {
            throw new Error(
              "BASE_INDISPONIBLE: base temporairement saturée. Réessayez plus tard ou contactez Margin."
            );
          }
          console.error("[auth] DB lookup failed", msg.slice(0, 200));
          throw new Error("BASE_INDISPONIBLE: connexion base impossible.");
        }
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          restaurantId: user.restaurantId,
          restaurantName: user.restaurant.name,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          restaurantId: string;
          restaurantName: string;
          sessionVersion?: number;
        };
        token.id = u.id;
        token.restaurantId = u.restaurantId;
        token.restaurantName = u.restaurantName;
        token.sessionVersion = u.sessionVersion ?? 0;
        return token;
      }

      // Re-resolve after DB seed/reset ; invalide JWT si sessionVersion a bougé
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { restaurant: true },
        });
        if (dbUser) {
          if (
            typeof token.sessionVersion === "number" &&
            dbUser.sessionVersion !== token.sessionVersion
          ) {
            token.id = undefined;
            token.restaurantId = undefined;
            token.restaurantName = undefined;
            token.sessionVersion = undefined;
            return token;
          }
          token.restaurantId = dbUser.restaurantId;
          token.restaurantName = dbUser.restaurant.name;
          token.sessionVersion = dbUser.sessionVersion;
        } else if (token.email) {
          const byEmail = await prisma.user.findUnique({
            where: { email: token.email as string },
            include: { restaurant: true },
          });
          if (byEmail) {
            token.id = byEmail.id;
            token.restaurantId = byEmail.restaurantId;
            token.restaurantName = byEmail.restaurant.name;
            token.sessionVersion = byEmail.sessionVersion;
          } else {
            token.id = undefined;
            token.restaurantId = undefined;
            token.restaurantName = undefined;
            token.sessionVersion = undefined;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (!token.restaurantId || !token.id) {
          return {
            ...session,
            user: {
              ...session.user,
              id: "",
              restaurantId: "",
              restaurantName: "",
            },
          };
        }
        session.user.id = token.id as string;
        session.user.restaurantId = token.restaurantId as string;
        session.user.restaurantName = token.restaurantName as string;
      }
      return session;
    },
  },
};
