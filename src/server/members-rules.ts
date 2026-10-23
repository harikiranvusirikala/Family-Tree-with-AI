// Members, invites and access requests (ARCHITECTURE.md §8, F3, F4): the rules that need no
// database. Pure, so every case is unit-tested.
import { hasRole, type Role } from "./roles";

/** The roles that can be given by invite, request or a role change. The Owner only by transfer. */
export const GRANTABLE_ROLES = ["view", "maintain", "admin"] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Admin", maintain: "Maintain", view: "View" };

/** What each role that can be given lets someone do (§8), where a role is chosen. */
export const ROLE_HINTS: Record<GrantableRole, string> = {
  view: "Sees the tree and its people",
  maintain: "Also adds and edits people, photos and sheets",
  admin: "Also lets people in and changes their roles",
};

/** A rule was broken; the message is shown to the person who tried. */
export class MemberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberError";
  }
}

/**
 * The form an email is compared in (F3): trimmed and lowercased; for Gmail, dots and "+tags" in the
 * name don't matter (cousin.ravi+family@gmail.com is cousinravi@gmail.com), and googlemail.com is the
 * same mailbox. Other providers may treat those differently, so their addresses are left alone.
 */
export function normalizeEmail(email: string): string {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at < 1) return lower;
  let [name, domain] = [lower.slice(0, at), lower.slice(at + 1)];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") name = name.split("+")[0].replaceAll(".", "");
  return `${name}@${domain}`;
}

/** "c*****@gmail.com": enough to recognise one's own address. Always five stars, so the length isn't shown. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 1 ? "*****" : `${email[0]}*****${email.slice(at)}`;
}

/**
 * Why `actor` can't change `target`'s membership (a new role, or removing them), or null. Admins and
 * the Owner manage everyone except the Owner, other Admins included (§8; decided in step 8).
 */
export function memberChangeProblem(actor: Role, target: Role, change: GrantableRole | "remove"): string | null {
  if (!hasRole(actor, "admin")) return "Only Admins and the Owner manage members.";
  if (target === "owner") {
    return change === "remove" ? "The owner can't be removed." : "The owner's role can't be changed. The owner can transfer ownership in Settings.";
  }
  return null;
}

/** Why `actor` can't hand ownership to a member whose role is `target`, or null. The old Owner becomes an Admin. */
export function transferProblem(actor: Role, target: Role, toSelf: boolean): string | null {
  if (actor !== "owner") return "Only the owner can transfer ownership.";
  if (toSelf || target === "owner") return "Choose another member.";
  return null;
}

/** Why someone with this role can't leave the group, or null. */
export function leaveProblem(role: Role): string | null {
  return role === "owner" ? "The owner can't leave. Transfer ownership to another member first." : null;
}
