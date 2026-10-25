// @vitest-environment node
import { describe, expect, test } from "vitest";
import { extendedExpiry, inviteLinkProblem, joiningRole, leaveProblem, maskEmail, MAX_LINK_USES, memberChangeProblem, normalizeEmail, transferProblem } from "./members-rules";
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

describe("invite links (an owner request, 2026-10-24)", () => {
  test("View or Maintain, for 1, 7 or 30 days, with an optional limit up to 500", () => {
    expect(inviteLinkProblem({ role: "view", days: 7 })).toBeNull();
    expect(inviteLinkProblem({ role: "maintain", days: 1, maxUses: 1 })).toBeNull();
    expect(inviteLinkProblem({ role: "view", days: 30, maxUses: MAX_LINK_USES })).toBeNull();
    expect(inviteLinkProblem({ role: "admin", days: 7 })).toBe("A link can give View or Maintain.");
    expect(inviteLinkProblem({ role: "owner", days: 7 })).toBe("A link can give View or Maintain.");
    for (const days of [0, 2, 365, "7", Infinity]) expect(inviteLinkProblem({ role: "view", days })).toBe("Choose 1, 7 or 30 days.");
    for (const maxUses of [0, -1, 1.5, MAX_LINK_USES + 1, "3", null]) expect(inviteLinkProblem({ role: "view", days: 7, maxUses })).toMatch(/whole number from 1 to 500/);
  });

  test("joining by a link gives the higher of its role and a pending email invite's", () => {
    expect(joiningRole("view", [])).toBe("view");
    expect(joiningRole("view", ["maintain"])).toBe("maintain");
    expect(joiningRole("maintain", ["view"])).toBe("maintain");
    expect(joiningRole("view", ["view", "admin"])).toBe("admin");
  });
});

describe("extending an invite link (an owner request, 2026-10-25)", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const day = 86_400_000;
  const at = (days: number) => new Date(now.getTime() + days * day);

  test("adds 1 or 7 days to the current expiry, however close it is", () => {
    expect(extendedExpiry(at(2), 7, now)).toEqual({ expiresAt: at(9) });
    expect(extendedExpiry(at(0.01), 1, now)).toEqual({ expiresAt: at(1.01) });
    for (const days of [0, 2, 30, "7", -7]) expect(extendedExpiry(at(2), days, now)).toEqual({ problem: "Extend by 1 or 7 days." });
  });

  test("never past 30 days from today", () => {
    expect(extendedExpiry(at(23), 7, now)).toEqual({ expiresAt: at(30) }); // exactly 30: allowed
    expect(extendedExpiry(at(24), 7, now)).toEqual({ problem: "A link can work at most 30 days from today." });
    expect(extendedExpiry(at(29.5), 1, now)).toEqual({ problem: "A link can work at most 30 days from today." });
  });
});
