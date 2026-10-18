"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/server/db";
import { groupChanged } from "@/server/group-changed";
import { FATHER_SHEET, newGroupOperations, newGroupSchema } from "@/server/operations/new-group";
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
