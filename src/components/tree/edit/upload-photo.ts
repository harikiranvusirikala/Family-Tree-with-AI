// F8 in the browser: check a chosen photo, shrink a large one, then upload it straight to Cloudinary
// with a ticket the server signed. Saving the photo on the person is a separate change (setPhoto).
import type { UploadTicket } from "@/server/cloudinary";

/** Cloudinary's free plan takes images up to 10 MB: what's uploaded, after shrinking. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** The largest file that can be chosen (a camera's original); bigger ones aren't read, for a phone's memory. */
export const MAX_CHOSEN_BYTES = 50 * 1024 * 1024;
/** Photos are shrunk to this on the long side before uploading: what Cloudinary keeps (STORED_PIXELS). */
export const SHRINK_TO = 2400;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
/** For the file picker. Some browsers give HEIC files no type, so the extension is listed too. */
export const PHOTO_ACCEPT = [...TYPES, ".heic"].join(",");

const TOO_BIG = (mb: number) => `That photo is over ${mb} MB. Choose a smaller one.`;

/** Why a chosen file can't be used as a photo, or null. Checked before it's read. */
export function photoFileProblem(file: Pick<File, "name" | "type" | "size">): string | null {
  const known = TYPES.includes(file.type) || (file.type === "" && /\.heic$/i.test(file.name));
  if (!known) return "Choose a JPEG, PNG, WebP or HEIC photo.";
  if (file.size > MAX_CHOSEN_BYTES) return TOO_BIG(50);
  return null;
}

/** Why a (shrunk) photo can't be uploaded, or null: a HEIC outside Safari, or an unreadable file, isn't shrunk. */
export function uploadSizeProblem(photo: Pick<Blob, "size">): string | null {
  return photo.size > MAX_PHOTO_BYTES ? TOO_BIG(10) : null;
}

/** The size to shrink a photo to, keeping its shape, or null when it's small enough already. */
export function shrunkSize(width: number, height: number, max = SHRINK_TO): { width: number; height: number } | null {
  const long = Math.max(width, height);
  if (long <= max) return null;
  const scale = max / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** What shrinking needs from the browser; tests pass stand-ins. */
export interface ImageTools {
  /** The decoded image, upright as the camera held it; throws when the browser can't read it (HEIC outside Safari). */
  decode: (file: Blob) => Promise<{ width: number; height: number; close?: () => void }>;
  /** The decoded image drawn at this size, as a JPEG. */
  encode: (image: CanvasImageSource, width: number, height: number) => Promise<Blob | null>;
}

const browserTools: ImageTools = {
  decode: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
  encode: (image, width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return Promise.resolve(null);
    context.fillStyle = "#fff"; // a PNG's see-through parts, which JPEG can't keep
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  },
};

/**
 * The photo to upload: shrunk to SHRINK_TO on the long side as a JPEG (which also drops the camera's
 * hidden details, such as where it was taken), or the file itself when it's small enough, the browser
 * can't read it, or shrinking doesn't make the file smaller. Cloudinary checks what it gets either way,
 * and keeps at most STORED_PIXELS.
 */
export async function shrinkPhoto(file: Blob, tools: ImageTools = browserTools): Promise<Blob> {
  let image: Awaited<ReturnType<ImageTools["decode"]>>;
  try {
    image = await tools.decode(file);
  } catch {
    return file;
  }
  try {
    const size = shrunkSize(image.width, image.height);
    if (!size) return file;
    const shrunk = await tools.encode(image as unknown as CanvasImageSource, size.width, size.height);
    // A heavily compressed photo can come out bigger; Cloudinary shrinks the original on arrival anyway.
    return shrunk && shrunk.size < file.size ? shrunk : file;
  } catch {
    return file;
  } finally {
    image.close?.();
  }
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
