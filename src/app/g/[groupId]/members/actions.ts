"use server";

import { z } from "zod";
import { getDatabase, type Database } from "@/server/db";
import { groupChanged } from "@/server/group-changed";
import { GRANTABLE_ROLES, inviteLinkProblem, MemberError } from "@/server/members-rules";
import { requireUser, type SessionUser } from "@/server/permissions";
import { decideRequest } from "@/server/repositories/access-requests";
import { createInviteLink, revokeInviteLink } from "@/server/repositories/invite-links";
import { createInvite, revokeInvite } from "@/server/repositories/invites";
import { changeRole, removeMember } from "@/server/repositories/members";
import { NoAccessError } from "@/server/roles";

export interface MemberFormState {
  error?: string;
  done?: string;
  /** A new invite's or invite link's token, for its link. */
  token?: string;
}

const role = z.enum(GRANTABLE_ROLES, { error: "Choose View, Maintain or Admin" });
const inviteFields = z.object({ email: z.email("Enter an email address").max(254), role });

/**
 * Every members-page action: signed in, then the repository function, which checks the role itself
 * (Admin and up) and the rules about the Owner. Server actions can be called directly (§8).
 */
async function attempt(groupId: string, work: (user: SessionUser, database: Database) => Promise<MemberFormState>): Promise<MemberFormState> {
  const user = await requireUser();
  try {
    const state = await work(user, await getDatabase());
    groupChanged(groupId);
    return state;
  } catch (error) {
    if (error instanceof NoAccessError) return { error: "Only Admins and the Owner manage members." };
    if (error instanceof MemberError) return { error: error.message };
    throw error;
  }
}

/** F3: an invite by email and role; the page shows its link to share. */
export async function inviteAction(groupId: string, _previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const parsed = inviteFields.safeParse({ email: String(formData.get("email") ?? "").trim(), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return attempt(groupId, async (user, { db }) => {
    const { token } = await createInvite(db, groupId, user.id, parsed.data);
    return { token, done: `Invite for ${parsed.data.email} is ready. Share this link with them:` };
  });
}

export async function revokeInviteAction(groupId: string, inviteId: string): Promise<MemberFormState> {
  return attempt(groupId, async (user, { db }) => {
    await revokeInvite(db, groupId, user.id, inviteId);
    return {};
  });
}

/** An invite link for anyone: a role (View or Maintain), 1, 7 or 30 days, and optionally a limit on people. */
export async function createInviteLinkAction(groupId: string, _previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const limited = formData.get("limited") === "on";
  const input = {
    role: formData.get("role"),
    days: Number(formData.get("days")),
    ...(limited && { maxUses: Number(formData.get("maxUses")) }),
  };
  const problem = inviteLinkProblem(input);
  if (problem) return { error: problem };
  return attempt(groupId, async (user, { db }) => {
    const { token } = await createInviteLink(db, groupId, user.id, input as Parameters<typeof createInviteLink>[3]);
    return { token, done: "Your link is ready. Share it with your family:" };
  });
}

export async function revokeInviteLinkAction(groupId: string, linkId: string): Promise<MemberFormState> {
  return attempt(groupId, async (user, { db }) => {
    await revokeInviteLink(db, groupId, user.id, linkId);
    return {};
  });
}

export async function changeRoleAction(groupId: string, userId: string, _previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const parsed = role.safeParse(formData.get("role"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return attempt(groupId, async (user, { db }) => {
    await changeRole(db, groupId, user.id, userId, parsed.data);
    return { done: "Role changed." };
  });
}

export async function removeMemberAction(groupId: string, userId: string): Promise<MemberFormState> {
  return attempt(groupId, async (user, { db }) => {
    await removeMember(db, groupId, user.id, userId);
    return {};
  });
}

/** F4: approve with the chosen role (the "approve" button), or deny (the "deny" button). */
export async function decideRequestAction(groupId: string, requestId: string, _previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const deny = formData.get("decision") === "deny";
  const parsed = role.safeParse(formData.get("role"));
  if (!deny && !parsed.success) return { error: parsed.error.issues[0].message };
  return attempt(groupId, async (user, database) => {
    await decideRequest(database, groupId, user.id, requestId, deny ? "deny" : parsed.data!);
    return {};
  });
}
