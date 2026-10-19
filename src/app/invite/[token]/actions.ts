"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/server/db";
import { groupChanged } from "@/server/group-changed";
import { MemberError } from "@/server/members-rules";
import { requireUser } from "@/server/permissions";
import { acceptInvite, declineInvite } from "@/server/repositories/invites";

export interface InviteAnswerState {
  error?: string;
}

/** F3: join the group, if the invite is for the signed-in email and still works, then open it. */
export async function acceptInviteAction(token: string): Promise<InviteAnswerState> {
  const user = await requireUser();
  let groupId;
  try {
    groupId = await acceptInvite(await getDatabase(), token, user);
  } catch (error) {
    if (error instanceof MemberError) return { error: error.message };
    throw error;
  }
  groupChanged(groupId);
  redirect(`/g/${groupId}`);
}

export async function declineInviteAction(token: string): Promise<InviteAnswerState> {
  const user = await requireUser();
  await declineInvite((await getDatabase()).db, token, user);
  groupChanged();
  redirect("/dashboard");
}
