import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const MOBILE_COOKIE = "margin_mobile";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    // Racine publique : amis / téléphone → landing, pas l’écran login
    if (!token && req.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/welcome", req.nextUrl.origin));
    }

    // JWT vide après un seed / reset → forcer login (évite boucle / ↔ onboarding)
    if (token && (!token.restaurantId || !token.id)) {
      const login = new URL("/login", req.nextUrl.origin);
      login.searchParams.set("error", "session");
      const res = NextResponse.redirect(login);
      res.cookies.delete("next-auth.session-token");
      res.cookies.delete("__Secure-next-auth.session-token");
      return res;
    }

    // ?mobile=1 → toute l’app en chrome mobile (cookie). ?mobile=0 → quit.
    const mobile = req.nextUrl.searchParams.get("mobile");
    if (mobile === "1" || mobile === "0") {
      const url = req.nextUrl.clone();
      url.searchParams.delete("mobile");
      // Import catalogue & fiches produit = PC uniquement (pas de "carte" en boutique)
      if (
        mobile === "1" &&
        (url.pathname.startsWith("/ingredients/menu") ||
          url.pathname.startsWith("/dishes"))
      ) {
        url.pathname = "/";
      }
      const res = NextResponse.redirect(url);
      if (mobile === "1") {
        res.cookies.set(MOBILE_COOKIE, "1", {
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
          sameSite: "lax",
        });
      } else {
        res.cookies.set(MOBILE_COOKIE, "", {
          path: "/",
          maxAge: 0,
        });
      }
      return res;
    }

    // Mode téléphone : pas d’accès à l’import catalogue ni aux fiches produit
    if (
      req.cookies.get(MOBILE_COOKIE)?.value === "1" &&
      (req.nextUrl.pathname.startsWith("/ingredients/menu") ||
        req.nextUrl.pathname.startsWith("/dishes"))
    ) {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        // Autoriser le passage sur / sans session → redirect /welcome ci-dessus
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
  ],
};
