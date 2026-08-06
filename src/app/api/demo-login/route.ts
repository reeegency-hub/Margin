import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { isDemoAutoLoginEnabled } from "@/lib/demo-login";

const DEMO_EMAIL = "gerant@marginshop.app";
const MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Connexion démo — désactivée en production sauf DEMO_AUTO_LOGIN=1.
 */
export async function GET(request: Request) {
  if (!isDemoAutoLoginEnabled()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login?error=session", request.url));
  }

  const user = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { restaurant: true },
  });
  if (!user?.restaurant) {
    return NextResponse.redirect(new URL("/login?error=session", request.url));
  }

  const token = await encode({
    token: {
      email: user.email,
      name: user.name,
      sub: user.id,
      id: user.id,
      restaurantId: user.restaurantId,
      restaurantName: user.restaurant.name,
    },
    secret,
    maxAge: MAX_AGE,
  });

  const url = new URL(request.url);
  const dest =
    user.restaurant.onboardingCompletedAt != null ? "/" : "/onboarding";
  const res = NextResponse.redirect(new URL(dest, url.origin));

  const secure = url.protocol === "https:";
  const cookieName = secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  res.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: MAX_AGE,
  });

  return res;
}
