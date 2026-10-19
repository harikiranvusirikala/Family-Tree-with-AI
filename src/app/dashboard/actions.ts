"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/server/db";
import { groupChanged } from "@/server/group-changed";
import { OperationError } from "@/server/operations/apply";
import { FATHER_SHEET, groupName, newGroupOperations, newGroupSchema } from "@/server/operations/new-group";
import { requireUser } from "@/server/permissions";
import { createGroup } from "@/server/repositories/groups";

export interface NewGroupFormState {
  error?: string;
  values?: Record<string, string>; // what was typed, shown again after an error
}

const LABELS: Record<string, string> = { fatherName: "Father's name", motherName: "Mother's name", child: "You" };

/** F2: creates the group with its first couple and two pinned sheets, then opens the father's sheet. */
export async function createGroupAction(_previous: NewGroupFormState, formData: FormData): Promise<NewGroupFormState> {
  const user = await requireUser();
  const values = Object.fromEntries(
    ["groupName", "fatherName", "motherName", "addMe", "myName", "myGender"].map((key) => [key, String(formData.get(key) ?? "")]),
  );
  const parsed = newGroupSchema.safeParse({
    groupName: values.groupName,
    fatherName: values.fatherName,
    motherName: values.motherName,
    child: values.addMe ? { name: values.myName, gender: values.myGender } : undefined,
  });
  if (!parsed.success) {
    const { path, message } = parsed.error.issues[0];
    const label = LABELS[String(path[0])];
    return { error: label ? `${label}: ${message}` : message, values };
  }

  const { groupId, idMap } = await createGroup(await getDatabase(), parsed.data.groupName, newGroupOperations(parsed.data), user.id);
  groupChanged();
  redirect(`/g/${groupId}/s/${idMap[FATHER_SHEET]}`);
}

/**
 * F10: a new group from an imported file, with the importer as Owner: the group, the membership and
 * the file's people in one transaction (createGroup). The operations were built in the browser and
 * are checked here like any batch. Opens the import's first sheet.
 */
export async function importGroupAction(name: string, operations: unknown): Promise<{ error: string }> {
  const user = await requireUser();
  const parsedName = groupName.safeParse(name);
  if (!parsedName.success) return { error: parsedName.error.issues[0].message };
  let created;
  try {
    created = await createGroup(await getDatabase(), parsedName.data, operations, user.id);
  } catch (error) {
    if (error instanceof OperationError) return { error: `Not imported: ${error.reason}.` };
    throw error;
  }
  groupChanged();
  redirect(`/g/${created.groupId}/s/${created.idMap["new:s0"]}`);
}
