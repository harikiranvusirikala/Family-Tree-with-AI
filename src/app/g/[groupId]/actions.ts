"use server";

import { after } from "next/server";
import { cloudinaryConfig, deletePhotos, type UploadTicket } from "@/server/cloudinary";
import { getDatabase } from "@/server/db";
import { groupChanged } from "@/server/group-changed";
import { OperationError } from "@/server/operations/apply";
import { requireUser } from "@/server/permissions";
import { PhotosNotSetUpError, signPhotoUpload } from "@/server/photos";
import { applyGroupChanges } from "@/server/repositories/groups";
import { NoAccessError } from "@/server/roles";

export type ChangeResult = { idMap: Record<string, string>; error?: undefined } | { error: string };

const NO_PERMISSION = "You don't have permission to change this tree.";

/**
 * Every edit made by hand (F6). Maintain and up, checked here on every call (a server action can be
 * called directly), then the single write path. The sheet page re-renders with the new data.
 */
export async function applyChangesAction(groupId: string, operations: unknown): Promise<ChangeResult> {
  const user = await requireUser();
  try {
    const { idMap, unusedPhotoIds } = await applyGroupChanges(await getDatabase(), groupId, user.id, operations);
    groupChanged(groupId);
    // Replaced or removed photos leave Cloudinary once the change is saved, without delaying the answer.
    if (unusedPhotoIds.length) after(() => deletePhotos(unusedPhotoIds, cloudinaryConfig()));
    return { idMap };
  } catch (error) {
    // The same answer for a Viewer, a non-member and a group that doesn't exist (§8).
    if (error instanceof NoAccessError) return { error: NO_PERMISSION };
    if (error instanceof OperationError) return { error: sentence(error.reason) };
    throw error;
  }
}

export type SignPhotoResult = { ticket: UploadTicket; error?: undefined } | { error: string };

/** F8: lets the browser upload one photo straight to Cloudinary. Saving it is a setPhoto change. */
export async function signPhotoUploadAction(groupId: string): Promise<SignPhotoResult> {
  const user = await requireUser();
  try {
    return { ticket: await signPhotoUpload((await getDatabase()).db, groupId, user.id, cloudinaryConfig()) };
  } catch (error) {
    if (error instanceof NoAccessError) return { error: NO_PERMISSION };
    if (error instanceof PhotosNotSetUpError) return { error: "Photos aren't set up on this site yet." };
    throw error;
  }
}

const sentence = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}.`;
