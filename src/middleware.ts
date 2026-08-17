import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import {
  DEVICE_COOKIE,
  FORCE_MOBILE_COOKIE,
  isMobileUserAgent,
  resolveDeviceType,
} from "@/lib/device";

function attachDeviceCookie(
  res: NextResponse,
  req: {
    headers: Headers;
    cookies: { get: (n: string) => { value: string } | undefined };
  }
) {
  const nextDevice = resolveDeviceType({
    forceMobile: req.cookies.get(FORCE_MOBILE_COOKIE)?.value === "1",
    userAgent: req.headers.get("user-agent"),
  });
  if (req.cookies.get(DEVICE_COOKIE)?.value !== nextDevice) {
    res.cookies.set(DEVICE_COOKIE, nextDevice, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }
  return res;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    // Racine publique : amis / téléphone → landing, pas l’écran login
    if (!token && req.nextUrl.pathname === "/") {
      return attachDeviceCookie(
        NextResponse.redirect(new URL("/welcome", req.nextUrl.origin)),
        req
      );
    }

    // JWT vide après un seed / reset → forcer login (évite boucle / ↔ onboarding)
    if (token && (!token.restaurantId || !token.id)) {
      const login = new URL("/login", req.nextUrl.origin);
      login.searchParams.set("error", "session");
      const res = NextResponse.redirect(login);
      res.cookies.delete("next-auth.session-token");
      res.cookies.delete("__Secure-next-auth.session-token");
      return attachDeviceCookie(res, req);
    }

    // ?mobile=1 → toute l’app en chrome mobile (cookie). ?mobile=0 → quit.
    const mobile = req.nextUrl.searchParams.get("mobile");
    if (mobile === "1" || mobile === "0") {
      const url = req.nextUrl.clone();
      url.searchParams.delete("mobile");
      if (
        mobile === "1" &&
        (url.pathname.startsWith("/ingredients/menu") ||
          url.pathname.startsWith("/dishes"))
      ) {
        url.pathname = "/";
      }
      const res = NextResponse.redirect(url);
      if (mobile === "1") {
        res.cookies.set(FORCE_MOBILE_COOKIE, "1", {
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
          sameSite: "lax",
        });
        res.cookies.set(DEVICE_COOKIE, "mobile", {
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
          sameSite: "lax",
        });
      } else {
        res.cookies.set(FORCE_MOBILE_COOKIE, "", {
          path: "/",
          maxAge: 0,
        });
        res.cookies.set(
          DEVICE_COOKIE,
          isMobileUserAgent(req.headers.get("user-agent"))
            ? "mobile"
            : "desktop",
          {
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
            sameSite: "lax",
          }
        );
      }
      return res;
    }

    const device = resolveDeviceType({
      forceMobile: req.cookies.get(FORCE_MOBILE_COOKIE)?.value === "1",
      cookieDevice: req.cookies.get(DEVICE_COOKIE)?.value,
      userAgent: req.headers.get("user-agent"),
    });

    // Mobile soft-launch : Stock / Courses / Inventaire / Caisse accessibles.
    // On garde hors mobile les écrans legacy / lourds peu utilisés en pilote.
    if (device === "mobile") {
      const p = req.nextUrl.pathname;
      const redirectHome =
        p.startsWith("/dishes") ||
        p.startsWith("/employees") ||
        p.startsWith("/costs") ||
        p.startsWith("/delivery") ||
        p.startsWith("/cuisine") ||
        p.startsWith("/receipts") ||
        p.startsWith("/assistant");
      if (redirectHome) {
        return attachDeviceCookie(
          NextResponse.redirect(new URL("/", req.nextUrl.origin)),
          req
        );
      }
    }

    return attachDeviceCookie(NextResponse.next(), req);
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname === "/") return true;
        return Boolean(token);
      },
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/onboarding",
    "/ingredients/:path*",
    "/dishes/:path*",
    "/sales",
    "/sales/:path*",
    "/receipts/:path*",
    "/settings/:path*",
    "/employees/:path*",
    "/inventory/:path*",
    "/orders/:path*",
    "/cuisine",
    "/cuisine/:path*",
    "/delivery/:path*",
    "/kiosks/:path*",
    "/admin",
    "/admin/:path*",
    "/costs/:path*",
    "/assistant",
    "/assistant/:path*",
  ],
};
