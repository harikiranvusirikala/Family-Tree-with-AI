"use server";

import { getDatabase } from "@/server/db";
import { groupChanged } from "@/server/group-changed";
import { OperationError } from "@/server/operations/apply";
import { requireUser } from "@/server/permissions";
import { applyGroupChanges } from "@/server/repositories/groups";
import { NoAccessError } from "@/server/roles";

export type ChangeResult = { idMap: Record<string, string>; error?: undefined } | { error: string };

/**
 * Every edit made by hand (F6). Maintain and up, checked here on every call (a server action can be
 * called directly), then the single write path. The sheet page re-renders with the new data.
 */
export async function applyChangesAction(groupId: string, operations: unknown): Promise<ChangeResult> {
  const user = await requireUser();
  try {
    const { idMap } = await applyGroupChanges(await getDatabase(), groupId, user.id, operations);
    groupChanged(groupId);
    return { idMap };
  } catch (error) {
    // The same answer for a Viewer, a non-member and a group that doesn't exist (§8).
    if (error instanceof NoAccessError) return { error: "You don't have permission to change this tree." };
    if (error instanceof OperationError) return { error: sentence(error.reason) };
    throw error;
  }
}

const sentence = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}.`;
