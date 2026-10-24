"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/server/db";
import { groupChanged } from "@/server/group-changed";
import { MemberError } from "@/server/members-rules";
import { requireUser } from "@/server/permissions";
import { joinByLink } from "@/server/repositories/invite-links";
import type { InviteAnswerState } from "../../invite/[token]/actions";

/** Join the group by an invite link, if it still lets people in, then open it. */
export async function joinByLinkAction(token: string): Promise<InviteAnswerState> {
  const user = await requireUser();
  let groupId;
  try {
    groupId = await joinByLink(await getDatabase(), token, user);
  } catch (error) {
    if (error instanceof MemberError) return { error: error.message };
    throw error;
  }
  groupChanged(groupId);
  redirect(`/g/${groupId}`);
}
