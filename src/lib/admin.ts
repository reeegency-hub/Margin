import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Seul compte qui voit l’espace fondateur (nav, bandeau, /admin). */
export const FOUNDER_EMAIL = "reeegency@gmail.com";

export function getAdminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([FOUNDER_EMAIL, ...fromEnv]));
}

/**
 * Accès fondateur — emails allowlist (transition) + User.role FOUNDER (DB).
 * Préférer `requireRole("FOUNDER")` pour les nouvelles routes.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getAdminEmails().includes(normalized);
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  try {
    const { requireRole } = await import("@/lib/auth/require-role");
    await requireRole("FOUNDER");
    return session;
  } catch {
    // Fallback allowlist email pendant migration rôle
    if (!session.user.email || !isAdminEmail(session.user.email)) {
      return null;
    }
    return session;
  }
}
