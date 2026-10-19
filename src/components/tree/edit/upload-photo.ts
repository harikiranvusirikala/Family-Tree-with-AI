// F8 in the browser: check a chosen photo, then upload it straight to Cloudinary with a ticket the
// server signed. Saving the photo on the person is a separate change (setPhoto).
import type { UploadTicket } from "@/server/cloudinary";

/** Cloudinary's free plan takes images up to 10 MB. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
/** For the file picker. Some browsers give HEIC files no type, so the extension is listed too. */
export const PHOTO_ACCEPT = [...TYPES, ".heic"].join(",");

/** Why a file can't be used as a photo, or null. Checked before anything is uploaded. */
export function photoFileProblem(file: Pick<File, "name" | "type" | "size">): string | null {
  const known = TYPES.includes(file.type) || (file.type === "" && /\.heic$/i.test(file.name));
  if (!known) return "Choose a JPEG, PNG, WebP or HEIC photo.";
  if (file.size > MAX_PHOTO_BYTES) return "That photo is over 10 MB. Choose a smaller one.";
  return null;
}

/** Uploads the file. Its photo id (as signed), or a message to show. */
export async function uploadPhoto(ticket: UploadTicket, file: Blob, fetchImpl: typeof fetch = fetch): Promise<{ photoId: string } | { error: string }> {
  const body = new FormData();
  for (const [key, value] of Object.entries(ticket.fields)) body.append(key, value);
  body.append("file", file);
  try {
    const response = await fetchImpl(ticket.url, { method: "POST", body });
    const result = (await response.json().catch(() => ({}))) as { public_id?: string; error?: { message?: string } };
    if (response.ok && result.public_id === ticket.publicId) return { photoId: ticket.publicId };
    const reason = result.error?.message; // e.g. "Invalid image file"
    if (reason) return { error: `The photo couldn't be uploaded: ${reason.replace(/\.?$/, ".")}` };
  } catch {
    // offline, or Cloudinary unreachable
  }
  return { error: "The photo couldn't be uploaded. Try again, or choose another photo." };
}
