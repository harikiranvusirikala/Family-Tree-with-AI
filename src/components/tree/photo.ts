"use client";

import { createContext } from "react";

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
 * A face-cropped square of the photo, in the best format and quality for the browser. Cloudinary
 * makes it on first request and caches it.
 */
export function photoUrl(cloudName: string, photoId: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_thumb,g_face,w_${PHOTO_PIXELS},h_${PHOTO_PIXELS}/f_auto,q_auto/${photoId}`;
}
