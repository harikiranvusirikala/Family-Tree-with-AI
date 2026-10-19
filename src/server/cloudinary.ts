// Cloudinary, for photos (F8). The app makes two calls, signing an upload and deleting a photo, so
// it signs them itself instead of using Cloudinary's SDK. No `server-only`, so unit and database
// tests can import it; the API secret is only ever read from the server's environment.
import { createHash, randomBytes } from "node:crypto";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** https://api.cloudinary.com; the e2e tests point it at their stand-in (e2e/cloudinary-stub.mts). */
  apiUrl: string;
}

/** From the CLOUDINARY_* variables, or undefined when photos aren't set up. */
export function cloudinaryConfig(env: Record<string, string | undefined> = process.env): CloudinaryConfig | undefined {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = env;
  if (!cloudName || !apiKey || !apiSecret) return undefined;
  return { cloudName, apiKey, apiSecret, apiUrl: env.CLOUDINARY_API_URL || "https://api.cloudinary.com" };
}

/**
 * Cloudinary's request signature: SHA-1 of the parameters sorted by name, joined as `key=value&…`,
 * followed by the API secret. As in Cloudinary's SDK (2.11.0, `api_sign_request`), a `&` inside a
 * pair is encoded, so a value can't smuggle in another parameter.
 */
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const text = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`.replaceAll("&", "%26"))
    .join("&");
  return createHash("sha1").update(text + apiSecret).digest("hex");
}

const timestamp = (now: number) => String(Math.floor(now / 1000));

/** What the browser needs to upload one photo straight to Cloudinary. */
export interface UploadTicket {
  url: string;
  /** Sent with the file: the signed parameters, `api_key` and `signature`. */
  fields: Record<string, string>;
  /** Where the photo will be stored; Cloudinary must answer with the same id. */
  publicId: string;
}

/** Image formats Cloudinary accepts for a photo (HEIC: iPhone photos). */
export const PHOTO_FORMATS = "jpg,png,webp,heic";

/**
 * A signed upload of one photo to a random id in the group's folder (`groups/{groupId}/`). `tag`
 * (the database name) tells local and preview photos apart in Cloudinary's Media Library.
 */
export function uploadTicket(config: CloudinaryConfig, groupId: string, tag: string, now = Date.now()): UploadTicket {
  const publicId = `groups/${groupId}/${randomBytes(16).toString("base64url")}`;
  const params = {
    public_id: publicId,
    timestamp: timestamp(now),
    tags: tag,
    allowed_formats: PHOTO_FORMATS,
    transformation: "c_limit,w_1600,h_1600", // store at most 1600 px on the long side
  };
  return {
    url: `${config.apiUrl}/v1_1/${config.cloudName}/image/upload`,
    fields: { ...params, api_key: config.apiKey, signature: signParams(params, config.apiSecret) },
    publicId,
  };
}

/**
 * Deletes photos nobody uses any more, also from Cloudinary's CDN (`invalidate`). Best effort: the
 * change that freed them is already saved, so a failure is logged, never thrown.
 */
export async function deletePhotos(photoIds: string[], config: CloudinaryConfig | undefined, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!config) {
    if (photoIds.length) console.warn("Photos aren't set up (CLOUDINARY_*), so these weren't deleted:", photoIds);
    return;
  }
  await Promise.all(
    photoIds.map(async (publicId) => {
      const params = { public_id: publicId, timestamp: timestamp(Date.now()), invalidate: "true" };
      const body = new URLSearchParams({ ...params, api_key: config.apiKey, signature: signParams(params, config.apiSecret) });
      try {
        const response = await fetchImpl(`${config.apiUrl}/v1_1/${config.cloudName}/image/destroy`, {
          method: "POST",
          body,
          signal: AbortSignal.timeout(10_000),
        });
        const result = (await response.json().catch(() => ({}))) as { result?: string };
        // "not found": already gone, which is what we wanted.
        if (!response.ok || (result.result !== "ok" && result.result !== "not found")) {
          console.error(`Couldn't delete photo ${publicId} from Cloudinary:`, response.status, result);
        }
      } catch (error) {
        console.error(`Couldn't delete photo ${publicId} from Cloudinary:`, error);
      }
    }),
  );
}
