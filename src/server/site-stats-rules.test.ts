// @vitest-environment node
import { describe, expect, test } from "vitest";
import { lastDays, shortGroupId, startOfWeek, weeklyCounts } from "./site-stats-rules";

// Sunday 25 October 2026, afternoon (UTC): the last day of the week that began on Monday 19 October.
const now = new Date("2026-10-25T15:00:00Z");

describe("the site stats' weeks and days", () => {
  test("weeks start on Monday, UTC", () => {
    expect(startOfWeek(now).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(startOfWeek(new Date("2026-10-19T00:00:00Z")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(startOfWeek(new Date("2026-10-18T23:59:59Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  test("dates are counted in their week, oldest week first; older dates are left out", () => {
    const counts = weeklyCounts(
      [new Date("2026-10-19T00:00:00Z"), new Date("2026-10-25T10:00:00Z"), new Date("2026-10-18T23:59:59Z"), new Date("2026-10-05T12:00:00Z"), new Date("2026-09-27T23:59:59Z")],
      now,
      4,
    );
    expect(counts).toEqual([
      { week: "2026-09-28", count: 0 },
      { week: "2026-10-05", count: 1 },
      { week: "2026-10-12", count: 1 },
      { week: "2026-10-19", count: 2 },
    ]);
  });

  test("the last days end today", () => {
    expect(lastDays(now, 3)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]);
  });

  test("a group shows as the end of its id", () => {
    expect(shortGroupId("0123456789abcdef01234567")).toBe("234567");
  });
});
