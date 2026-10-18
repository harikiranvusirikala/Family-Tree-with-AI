import { describe, expect, test } from "vitest";
import { formatYears } from "./years";

describe("formatYears", () => {
  test("living person shows only the birth year, never 'Present'", () => {
    expect(formatYears(1985)).toBe("1985");
  });
  test("person who has died shows both years with an en dash", () => {
    expect(formatYears(1945, 2022)).toBe("1945 – 2022");
  });
  test("unknown years are left out", () => {
    expect(formatYears(undefined, 2022)).toBe("d. 2022");
    expect(formatYears()).toBe("");
  });
});
