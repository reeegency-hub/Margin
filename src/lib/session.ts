import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";
import type { TenantContext } from "@/lib/tenant";
import { hasAppAccess } from "@/lib/stripe/access";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.restaurantId || !session.user.id) {
    redirect("/login");
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
    select: {
      id: true,
      active: true,
      stripeStatus: true,
      accessGraceUntil: true,
    },
  });
  if (!restaurant) {
    redirect("/login?error=session");
  }

  if (
    !hasAppAccess(restaurant) &&
    !isAdminEmail(session.user.email)
  ) {
    redirect("/login?error=billing");
  }

  return session;
}

/** Contexte tenant pour les features (alias restaurantId). */
export async function requireTenant(): Promise<TenantContext> {
  const session = await requireSession();
  return {
    tenantId: session.user.restaurantId,
    userId: session.user.id,
    email: session.user.email,
  };
}

/** Contexte tenant + DB scoped RLS (transaction Postgres). */
export async function requireTenantDb<T>(
  fn: (
    db: import("@/lib/db").TenantDb,
    ctx: TenantContext
  ) => Promise<T>
): Promise<T> {
  const { withTenantRls } = await import("@/lib/db");
  const ctx = await requireTenant();
  return withTenantRls(ctx.tenantId, (db) => fn(db, ctx));
}
