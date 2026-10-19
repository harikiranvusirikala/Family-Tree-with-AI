import type { Db } from "mongodb";
import { uploadTicket, type CloudinaryConfig, type UploadTicket } from "./cloudinary";
import { roleInGroup } from "./repositories/groups";
import { MIN_ROLE } from "./roles";

export class PhotosNotSetUpError extends Error {
  constructor() {
    super("Photos aren't set up: the CLOUDINARY_* variables are missing");
  }
}

/**
 * F8: a signed upload into the group's folder, for Maintain and up (photos are edits). NoAccessError
 * otherwise, the same for a Viewer, a non-member and a group that doesn't exist (§8).
 */
export async function signPhotoUpload(db: Db, groupId: string, userId: string, config: CloudinaryConfig | undefined): Promise<UploadTicket> {
  await roleInGroup(db, groupId, userId, MIN_ROLE.edit);
  if (!config) throw new PhotosNotSetUpError();
  return uploadTicket(config, groupId, db.databaseName);
}
