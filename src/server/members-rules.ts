// Members, invites and access requests (ARCHITECTURE.md §8, F3, F4): the rules that need no
// database. Pure, so every case is unit-tested.
import { hasRole, RANK, type Role } from "./roles";

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

/** The roles an invite link can give (an owner request, 2026-10-24): never Admin, as anyone the link reaches gets it. */
export const LINK_ROLES = ["view", "maintain"] as const;
export type LinkRole = (typeof LINK_ROLES)[number];

/** How long an invite link can work, in days; the first is the default. No "never": a link always stops. */
export const LINK_DAYS = [7, 1, 30] as const;

/** How many days an active link can be extended by (an owner request, 2026-10-25). */
export const EXTEND_DAYS = [1, 7] as const;

/** A link never works for more than this many days ahead, however often it's extended. */
const LONGEST_LINK_DAYS = Math.max(...LINK_DAYS);
const DAY = 86_400_000;

/**
 * A link's new expiry after adding `days` to its current one, or why it can't be extended: only by 1
 * or 7 days, and never past 30 days from `now` (a link always stops).
 */
export function extendedExpiry(expiresAt: Date, days: unknown, now: Date): { expiresAt: Date } | { problem: string } {
  if (!EXTEND_DAYS.includes(days as (typeof EXTEND_DAYS)[number])) return { problem: "Extend by 1 or 7 days." };
  const next = new Date(expiresAt.getTime() + (days as number) * DAY);
  if (next.getTime() > now.getTime() + LONGEST_LINK_DAYS * DAY) return { problem: `A link can work at most ${LONGEST_LINK_DAYS} days from today.` };
  return { expiresAt: next };
}

/** At most this many people per link, when the Admin sets a limit. */
export const MAX_LINK_USES = 500;

/** Why an invite link with these settings can't be made, or null. */
export function inviteLinkProblem(input: { role: unknown; days: unknown; maxUses?: unknown }): string | null {
  if (!LINK_ROLES.includes(input.role as LinkRole)) return "A link can give View or Maintain.";
  if (!LINK_DAYS.includes(input.days as (typeof LINK_DAYS)[number])) return "Choose 1, 7 or 30 days.";
  const { maxUses } = input;
  if (maxUses !== undefined && !(Number.isInteger(maxUses) && (maxUses as number) >= 1 && (maxUses as number) <= MAX_LINK_USES)) {
    return `The limit must be a whole number from 1 to ${MAX_LINK_USES}.`;
  }
  return null;
}

/** The role someone joining by a link gets: the higher of the link's and a pending email invite's (decision 4). */
export function joiningRole(linkRole: LinkRole, inviteRoles: GrantableRole[]): GrantableRole {
  return [linkRole, ...inviteRoles].reduce((best, r) => (RANK[r] > RANK[best] ? r : best));
}
