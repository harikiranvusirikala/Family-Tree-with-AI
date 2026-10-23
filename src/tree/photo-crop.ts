// The rectangle around a person in a group photo (an owner request): drawing, moving and resizing it in
// the "Which one is …?" dialog. Pure: every point and rectangle is in fractions (0–1) of the photo's
// width and height, as Person.photoCrop is saved.
import type { PhotoCrop } from "./types";

/** The smallest rectangle, as a fraction of the photo's width or height (also checked by the server). */
export const MIN_CROP = 0.02;

export interface Point {
  x: number;
  y: number;
}

/** A rectangle's corner, for resizing: north-west, north-east, south-west, south-east. */
export type Corner = "nw" | "ne" | "sw" | "se";
export const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];

const clamp = (n: number, low = 0, high = 1) => Math.min(high, Math.max(low, n));

/** The rectangle between two points, in either order, kept inside the photo. */
export function cropBetween(a: Point, b: Point): PhotoCrop {
  const [x1, x2] = [clamp(a.x), clamp(b.x)].sort((p, q) => p - q);
  const [y1, y2] = [clamp(a.y), clamp(b.y)].sort((p, q) => p - q);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Big enough to keep: a click without a drag draws nothing. */
export const isUsable = (crop: PhotoCrop) => crop.w >= MIN_CROP && crop.h >= MIN_CROP;

/** Moved by (dx, dy), stopping at the photo's edges. */
export function moveCrop(crop: PhotoCrop, dx: number, dy: number): PhotoCrop {
  return { ...crop, x: clamp(crop.x + dx, 0, 1 - crop.w), y: clamp(crop.y + dy, 0, 1 - crop.h) };
}

/** The corner opposite `corner`, which stays put while `corner` is dragged. */
function opposite(crop: PhotoCrop, corner: Corner): Point {
  return { x: corner.endsWith("w") ? crop.x + crop.w : crop.x, y: corner.startsWith("n") ? crop.y + crop.h : crop.y };
}

/**
 * `corner` dragged to `to`, the opposite corner staying put; never smaller than MIN_CROP (it stops
 * rather than turning inside out) and never outside the photo.
 */
export function resizeCrop(crop: PhotoCrop, corner: Corner, to: Point): PhotoCrop {
  const fixed = opposite(crop, corner);
  const x = corner.endsWith("w") ? clamp(to.x, 0, fixed.x - MIN_CROP) : clamp(to.x, fixed.x + MIN_CROP, 1);
  const y = corner.startsWith("n") ? clamp(to.y, 0, fixed.y - MIN_CROP) : clamp(to.y, fixed.y + MIN_CROP, 1);
  return cropBetween(fixed, { x, y });
}

/** Grown (or shrunk, with a negative step) by `dw` and `dh` from its top-left corner: Shift and the arrow keys. */
export function growCrop(crop: PhotoCrop, dw: number, dh: number): PhotoCrop {
  return { ...crop, w: clamp(crop.w + dw, MIN_CROP, 1 - crop.x), h: clamp(crop.h + dh, MIN_CROP, 1 - crop.y) };
}

/** Where the keyboard starts: the middle half of the photo. */
export const MIDDLE_CROP: PhotoCrop = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };

/** Rounded to four decimals for saving (Cloudinary's URL writes four), still inside the photo. */
export function roundCrop(crop: PhotoCrop): PhotoCrop {
  const r = (n: number) => Math.round(n * 10_000) / 10_000;
  const x = r(crop.x);
  const y = r(crop.y);
  return { x, y, w: Math.min(r(crop.w), r(1 - x)), h: Math.min(r(crop.h), r(1 - y)) };
}
