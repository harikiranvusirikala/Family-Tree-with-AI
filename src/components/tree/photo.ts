"use client";

import { createContext } from "react";
import type { PhotoCrop } from "@/tree/types";

/**
 * The Cloudinary cloud name, when photos are set up. Not secret: it's in every photo URL. Given by the
 * sheets layout; without it (the dev pages) cards show initials.
 */
export const CloudNameContext = createContext<string | undefined>(undefined);

/**
 * True while the eye button hides every photo, so cards and panels show initials, and so does a
 * picture of the sheet (an owner request after step 11). Given by the sheets page.
 */
export const PhotosHiddenContext = createContext(false);

/** Twice the card's photo circle (PHOTO_SIZE), for sharp screens. The panel reuses it, so each photo downloads once. */
export const PHOTO_PIXELS = 168;

/**
 * A face-cropped square of the photo, in the best format and quality for the browser. With a `crop`
 * (an owner request), the face is looked for only inside that rectangle, so a group photo shows this
 * person. Cloudinary makes it on first request and caches it.
 */
export function photoUrl(cloudName: string, photoId: string, crop?: PhotoCrop): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${crop ? `${cropStep(crop)}/` : ""}c_thumb,g_face,w_${PHOTO_PIXELS},h_${PHOTO_PIXELS}/f_auto,q_auto/${photoId}`;
}

/**
 * Cloudinary's crop to a rectangle given as fractions of the photo. Always written with a decimal
 * point: Cloudinary reads a number with one as relative to the photo's size, so `w_1.0000` is the
 * whole width, but `w_1` would be one pixel.
 */
function cropStep({ x, y, w, h }: PhotoCrop): string {
  const f = (n: number) => n.toFixed(4);
  return `c_crop,x_${f(x)},y_${f(y)},w_${f(w)},h_${f(h)}`;
}

/**
 * The same face-cropped photo as `photoUrl`, at `pixels` square instead: an exported picture is drawn at
 * up to four times the screen's size, where the cards' 168-pixel photos would look soft. Any other
 * address comes back unchanged.
 */
export function sharperPhotoUrl(src: string, pixels: number): string {
  if (!src.startsWith("https://res.cloudinary.com/")) return src;
  return src.replace(`c_thumb,g_face,w_${PHOTO_PIXELS},h_${PHOTO_PIXELS}/`, `c_thumb,g_face,w_${pixels},h_${pixels}/`);
}

/** The whole photo, at most `size` pixels on the long side: for choosing where someone is in it. */
export function wholePhotoUrl(cloudName: string, photoId: string, size: number): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_limit,w_${size},h_${size}/f_auto,q_auto/${photoId}`;
}
