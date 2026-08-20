import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

async function restaurantSessionFields(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      name: true,
      plan: true,
      networkId: true,
    },
  });
  return {
    restaurantName: restaurant?.name ?? "",
    plan: restaurant?.plan ?? null,
    networkId: restaurant?.networkId ?? null,
  };
}

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

        // Bootstrap network si plan Franchise sans network (upgrade / legacy)
        let networkId = user.restaurant.networkId;
        const plan = user.restaurant.plan;
        if (plan === "reseau" && !networkId) {
          const { ensureFranchiseNetwork } = await import(
            "@/lib/franchise-network"
          );
          const ensured = await ensureFranchiseNetwork(user.restaurantId);
          networkId = ensured.networkId;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          restaurantId: user.restaurantId,
          restaurantName: user.restaurant.name,
          sessionVersion: user.sessionVersion,
          plan,
          networkId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          id: string;
          restaurantId: string;
          restaurantName: string;
          sessionVersion?: number;
          plan?: string | null;
          networkId?: string | null;
        };
        token.id = u.id;
        token.restaurantId = u.restaurantId;
        token.restaurantName = u.restaurantName;
        token.sessionVersion = u.sessionVersion ?? 0;
        token.plan = u.plan ?? null;
        token.networkId = u.networkId ?? null;
        return token;
      }

      // Switch boutique Franchise (update session côté client / server)
      if (trigger === "update" && session?.restaurantId && token.id) {
        const nextId = String(session.restaurantId);
        const { userCanAccessRestaurant, assertSameNetwork } = await import(
          "@/lib/franchise-network"
        );
        const allowed = await userCanAccessRestaurant(
          token.id as string,
          nextId
        );
        if (allowed) {
          const sameNet =
            !token.restaurantId ||
            (await assertSameNetwork(token.restaurantId as string, nextId));
          if (sameNet || token.plan === "reseau") {
            const fields = await restaurantSessionFields(nextId);
            token.restaurantId = nextId;
            token.restaurantName = fields.restaurantName;
            token.plan = fields.plan;
            token.networkId = fields.networkId;
          }
        }
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
            token.plan = undefined;
            token.networkId = undefined;
            return token;
          }
          token.restaurantId = dbUser.restaurantId;
          token.restaurantName = dbUser.restaurant.name;
          token.sessionVersion = dbUser.sessionVersion;
          token.plan = dbUser.restaurant.plan;
          token.networkId = dbUser.restaurant.networkId;
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
            token.plan = byEmail.restaurant.plan;
            token.networkId = byEmail.restaurant.networkId;
          } else {
            token.id = undefined;
            token.restaurantId = undefined;
            token.restaurantName = undefined;
            token.sessionVersion = undefined;
            token.plan = undefined;
            token.networkId = undefined;
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
              plan: null,
              networkId: null,
            },
          };
        }
        session.user.id = token.id as string;
        session.user.restaurantId = token.restaurantId as string;
        session.user.restaurantName = token.restaurantName as string;
        session.user.plan = (token.plan as string | null) ?? null;
        session.user.networkId = (token.networkId as string | null) ?? null;
      }
      return session;
    },
  },
};
