import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requirePartnerAuthSecret } from "@/lib/security/prod-secrets";

import { PARTNER_COOKIE } from "@/lib/partner-auth-constants";

export { PARTNER_COOKIE } from "@/lib/partner-auth-constants";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type PartnerToken = {
  sub: string;
  email: string;
  name: string;
  exp: number;
};

function secret(): string {
  return requirePartnerAuthSecret();
}

function sign(payload: Omit<PartnerToken, "exp">, maxAgeSec = MAX_AGE_SEC): string {
  const token: PartnerToken = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const body = Buffer.from(JSON.stringify(token), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(raw: string): PartnerToken | null {
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const token = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as PartnerToken;
    if (!token.sub || !token.exp || token.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export async function setPartnerCookie(ambassador: {
  id: string;
  email: string;
  name: string;
}) {
  const jar = await cookies();
  jar.set(PARTNER_COOKIE, sign({
    sub: ambassador.id,
    email: ambassador.email,
    name: ambassador.name,
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearPartnerCookie() {
  const jar = await cookies();
  jar.set(PARTNER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getPartnerToken(): Promise<PartnerToken | null> {
  const jar = await cookies();
  const raw = jar.get(PARTNER_COOKIE)?.value;
  if (!raw) return null;
  return verify(raw);
}

export async function requireAmbassador() {
  const token = await getPartnerToken();
  if (!token) return null;
  const ambassador = await prisma.ambassador.findUnique({
    where: { id: token.sub },
    select: { id: true, email: true, name: true, active: true, status: true },
  });
  if (!ambassador?.active || ambassador.status !== "actif") return null;
  return ambassador;
}
