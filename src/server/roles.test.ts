// @vitest-environment node
import { describe, expect, test } from "vitest";
import { can, hasRole, MIN_ROLE, ROLES, type Action, type Role } from "./roles";

// ARCHITECTURE.md §8, written out row by row so a change to MIN_ROLE has to match the table.
const TABLE: Record<Action, Role[]> = {
  viewTree: ["view", "maintain", "admin", "owner"],
  askChat: ["view", "maintain", "admin", "owner"],
  exportPicture: ["view", "maintain", "admin", "owner"],
  edit: ["maintain", "admin", "owner"],
  confirmAiChanges: ["maintain", "admin", "owner"],
  importData: ["maintain", "admin", "owner"],
  exportData: ["maintain", "admin", "owner"],
  manageMembers: ["admin", "owner"],
  handleAccessRequests: ["admin", "owner"],
  renameGroup: ["owner"],
  deleteGroup: ["owner"],
  transferOwnership: ["owner"],
};

describe("the §8 role × action table", () => {
  test("covers every action", () => {
    expect(Object.keys(TABLE).sort()).toEqual(Object.keys(MIN_ROLE).sort());
  });

  const cases = (Object.keys(TABLE) as Action[]).flatMap((action) => ROLES.map((role) => [role, action, TABLE[action].includes(role)] as const));
  test.each(cases)("%s → %s: %s", (role, action, allowed) => {
    expect(can(role, action)).toBe(allowed);
  });
});

test("roles rank view < maintain < admin < owner", () => {
  expect(ROLES).toEqual(["view", "maintain", "admin", "owner"]);
  for (const [i, role] of ROLES.entries()) {
    for (const [j, min] of ROLES.entries()) expect(hasRole(role, min)).toBe(i >= j);
  }
});
