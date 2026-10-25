// @vitest-environment node
import { describe, expect, test } from "vitest";
import { isSiteAdmin } from "./site-admin";

describe("who sees the site stats", () => {
  const env = { SITE_ADMIN_EMAILS: " owner@example.com , Hari.Kiran+site@gmail.com" };

  test("only the listed addresses", () => {
    expect(isSiteAdmin("owner@example.com", env)).toBe(true);
    expect(isSiteAdmin("someone@example.com", env)).toBe(false);
  });

  test("compared like invites: case, gmail dots and +tags don't matter", () => {
    expect(isSiteAdmin("OWNER@example.com", env)).toBe(true);
    expect(isSiteAdmin("harikiran@googlemail.com", env)).toBe(true);
  });

  test("nobody without the variable, or with an empty one", () => {
    expect(isSiteAdmin("owner@example.com", {})).toBe(false);
    expect(isSiteAdmin("owner@example.com", { SITE_ADMIN_EMAILS: " , " })).toBe(false);
    expect(isSiteAdmin("", { SITE_ADMIN_EMAILS: "," })).toBe(false);
  });
});
