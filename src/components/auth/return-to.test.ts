// @vitest-environment node
import { describe, expect, test } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  test("keeps a path on this site, with its query", () => {
    expect(safeReturnTo("/dashboard?tab=x")).toBe("/dashboard?tab=x");
    expect(safeReturnTo("/g/abc/s/def")).toBe("/g/abc/s/def");
  });

  test.each([
    ["//evil.com"],
    ["/\\evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
    ["/\t/evil.com"], // browsers drop the tab, leaving //evil.com
    ["/"],
    ["/?returnTo=x"],
    [""],
    [null],
    [undefined],
  ])("%j gives /dashboard", (value) => {
    expect(safeReturnTo(value)).toBe("/dashboard");
  });
});
