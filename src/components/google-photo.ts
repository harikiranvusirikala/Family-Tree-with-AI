// Accounts' Google photos: the account button, the members page and access requests (owner requests,
// 2026-10-25). Better Auth saves Google's `picture` as the user's `image` (refreshGooglePhoto keeps it
// current at each sign-in): an address on googleusercontent.com ending in a size like "=s96-c" (96 px,
// cropped square). The app asks for a bigger one, so the photo stays sharp on high-density screens.

/** Pixels asked of Google: the 32–36 px circles at up to 7× (Google sends a small file either way). */
export const ACCOUNT_PHOTO_PIXELS = 256;

/**
 * Google's photo address at `pixels` square, or null for anything else (no image, another site's
 * address: the CSP's img-src allows only googleusercontent.com besides Cloudinary).
 */
export function googlePhotoUrl(image: string | null | undefined, pixels = ACCOUNT_PHOTO_PIXELS): string | null {
  if (!image) return null;
  let url: URL;
  try {
    url = new URL(image);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".googleusercontent.com")) return null;
  const size = `=s${pixels}-c`;
  // "…/a/ACg8oc…=s96-c" → "…=s256-c"; an address with no size gets one; other options are kept as they are.
  if (/=s\d+(-c)?$/.test(url.pathname)) url.pathname = url.pathname.replace(/=s\d+(-c)?$/, size);
  else if (!url.pathname.includes("=")) url.pathname += size;
  return url.toString();
}
