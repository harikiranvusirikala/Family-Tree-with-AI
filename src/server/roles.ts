// Roles and what each may do (ARCHITECTURE.md §8). Pure, so the table is unit-tested.

export const RANK = { view: 1, maintain: 2, admin: 3, owner: 4 } as const;
export type Role = keyof typeof RANK;
export const ROLES = Object.keys(RANK) as Role[];

/** The lowest role allowed to do each thing in §8's table. */
export const MIN_ROLE = {
  viewTree: "view", // see trees, people and photos
  askChat: "view", // ask the AI chat questions
  exportPicture: "view", // PNG/PDF of a sheet
  edit: "maintain", // add, edit and delete people, photos and sheets
  confirmAiChanges: "maintain",
  importData: "maintain",
  exportData: "maintain", // JSON/GEDCOM
  manageMembers: "admin", // invite and remove members, change roles (up to Admin)
  handleAccessRequests: "admin",
  renameGroup: "owner",
  deleteGroup: "owner",
  transferOwnership: "owner",
} as const satisfies Record<string, Role>;

export type Action = keyof typeof MIN_ROLE;

export function hasRole(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export function can(role: Role, action: Action): boolean {
  return hasRole(role, MIN_ROLE[action]);
}

/**
 * Not a member with a high enough role. Deliberately the same whether or not the group exists, so
 * tree links can't be used to probe for groups.
 */
export class NoAccessError extends Error {
  constructor() {
    super("No access");
    this.name = "NoAccessError";
  }
}
