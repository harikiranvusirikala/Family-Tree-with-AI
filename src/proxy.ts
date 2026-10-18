import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { proxyDecision } from "@/server/proxy-rules";

/**
 * Next.js 16's middleware. Sends signed-out visitors to sign in, then back to the link they opened.
 * It only checks that a session cookie is present; whether the session is valid is checked by each
 * page, server action and route (requireUser, and requireRole from step 5).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const decision = proxyDecision({
    pathname,
    search,
    method: request.method,
    hasSessionCookie: getSessionCookie(request) !== null,
  });
  switch (decision.action) {
    case "sign-in":
      return NextResponse.redirect(new URL(decision.location, request.url), 307);
    case "unauthorized":
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    default:
      return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
