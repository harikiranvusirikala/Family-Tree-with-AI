// @vitest-environment node
import { describe, expect, test } from "vitest";
import { leaveProblem, maskEmail, memberChangeProblem, normalizeEmail, transferProblem } from "./members-rules";
import { ROLES, type Role } from "./roles";

describe("emails (F3)", () => {
  test.each([
    ["  Cousin@Example.com ", "cousin@example.com"],
    ["cousin.ravi+family@gmail.com", "cousinravi@gmail.com"],
    ["Cousin.Ravi@GMAIL.com", "cousinravi@gmail.com"],
    ["cousin.ravi+x@googlemail.com", "cousinravi@gmail.com"],
    ["cousin.ravi+family@example.com", "cousin.ravi+family@example.com"], // other providers: as given
    ["not-an-email", "not-an-email"],
  ])("%s is compared as %s", (email, normalized) => {
    expect(normalizeEmail(email)).toBe(normalized);
  });

  test("masked: the first letter and the domain, always five stars", () => {
    expect(maskEmail("cousin@gmail.com")).toBe("c*****@gmail.com");
    expect(maskEmail("ab@example.com")).toBe("a*****@example.com");
    expect(maskEmail("nonsense")).toBe("*****");
  });
});

// Every role pair, so a change to the rules has to match this table.
const ANYONE: Role[] = ROLES;
const MANAGERS = new Set<Role>(["admin", "owner"]);

describe("who may change whom (§8)", () => {
  test.each(ANYONE.flatMap((actor) => ANYONE.map((target) => [actor, target] as const)))("%s changing or removing %s", (actor, target) => {
    const allowed = MANAGERS.has(actor) && target !== "owner";
    for (const change of ["view", "maintain", "admin", "remove"] as const) {
      expect(memberChangeProblem(actor, target, change) === null).toBe(allowed);
    }
  });

  test("the Owner can't be removed or have their role changed, and says why", () => {
    expect(memberChangeProblem("admin", "owner", "remove")).toBe("The owner can't be removed.");
    expect(memberChangeProblem("owner", "owner", "view")).toMatch(/transfer ownership in Settings/);
    expect(memberChangeProblem("maintain", "view", "admin")).toBe("Only Admins and the Owner manage members.");
  });

  test.each(ANYONE.flatMap((actor) => ANYONE.map((target) => [actor, target] as const)))("%s transferring ownership to %s", (actor, target) => {
    expect(transferProblem(actor, target, false) === null).toBe(actor === "owner" && target !== "owner");
  });

  test("not to oneself; and only the Owner can't leave", () => {
    expect(transferProblem("owner", "admin", true)).toBe("Choose another member.");
    expect(ANYONE.filter((role) => leaveProblem(role) !== null)).toEqual(["owner"]);
  });
});
