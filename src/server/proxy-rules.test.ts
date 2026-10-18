// @vitest-environment node
import { describe, expect, test } from "vitest";
import { proxyDecision, type ProxyRequest } from "./proxy-rules";

const signedOut = (pathname: string, more: Partial<ProxyRequest> = {}) =>
  proxyDecision({ pathname, search: "", method: "GET", hasSessionCookie: false, ...more });

describe("proxyDecision", () => {
  test.each(["/", "/api/auth/callback/google", "/api/auth/get-session", "/dev/tree", "/dev/tree/db", "/_next/data/x.json", "/favicon.ico", "/robots.txt"])(
    "%s is public",
    (pathname) => {
      expect(signedOut(pathname)).toEqual({ action: "continue" });
      expect(signedOut(pathname, { method: "POST" })).toEqual({ action: "continue" });
    },
  );

  test("a signed-out page load goes to sign-in, keeping the path and query", () => {
    expect(signedOut("/dashboard", { search: "?tab=x" })).toEqual({ action: "sign-in", location: "/?returnTo=%2Fdashboard%3Ftab%3Dx" });
    expect(signedOut("/g/abc/s/def", { method: "HEAD" })).toEqual({ action: "sign-in", location: "/?returnTo=%2Fg%2Fabc%2Fs%2Fdef" });
  });

  test("pages not listed are covered too (deny by default)", () => {
    expect(signedOut("/some/future/page")).toMatchObject({ action: "sign-in" });
    expect(signedOut("/developer")).toMatchObject({ action: "sign-in" }); // only /dev and below are public
  });

  test("Next.js's internal _rsc parameter isn't kept", () => {
    expect(signedOut("/dashboard", { search: "?_rsc=1x2y" })).toEqual({ action: "sign-in", location: "/?returnTo=%2Fdashboard" });
  });

  test("signed-out API calls and form posts get 401", () => {
    expect(signedOut("/api/chat")).toEqual({ action: "unauthorized" });
    expect(signedOut("/api/chat", { method: "POST" })).toEqual({ action: "unauthorized" });
    expect(signedOut("/dashboard", { method: "POST" })).toEqual({ action: "unauthorized" }); // a server action
  });

  test("any session cookie continues; the page itself checks it", () => {
    for (const [pathname, method] of [["/dashboard", "GET"], ["/api/chat", "POST"], ["/", "GET"]]) {
      expect(proxyDecision({ pathname, search: "", method, hasSessionCookie: true })).toEqual({ action: "continue" });
    }
  });
});
