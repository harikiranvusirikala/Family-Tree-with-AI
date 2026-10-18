"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/server/db";
import { groupChanged } from "@/server/group-changed";
import { groupName } from "@/server/operations/new-group";
import { noAccessToNull, requireRole } from "@/server/permissions";
import { deleteGroup, renameGroup } from "@/server/repositories/groups";
import { MIN_ROLE } from "@/server/roles";

export interface SettingsFormState {
  error?: string;
  saved?: boolean;
}

const NO_ACCESS = "Only the group's owner can do this.";

// Each action checks the role itself: server actions can be called directly (§8).

export async function renameGroupAction(groupId: string, _previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const access = await requireRole(groupId, MIN_ROLE.renameGroup).catch(noAccessToNull);
  if (!access) return { error: NO_ACCESS };
  const name = groupName.safeParse(formData.get("name") ?? "");
  if (!name.success) return { error: name.error.issues[0].message };
  await renameGroup((await getDatabase()).db, groupId, name.data, access.user.id);
  groupChanged(groupId); // also refreshes this page's header
  return { saved: true };
}

export async function deleteGroupAction(groupId: string, _previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const access = await requireRole(groupId, MIN_ROLE.deleteGroup).catch(noAccessToNull);
  if (!access) return { error: NO_ACCESS };
  if (String(formData.get("confirm") ?? "").trim() !== access.group.name) {
    return { error: `Type the group's name, ${access.group.name}, to confirm.` };
  }
  await deleteGroup((await getDatabase()).db, groupId, access.user.id);
  groupChanged(groupId);
  redirect("/dashboard");
}
