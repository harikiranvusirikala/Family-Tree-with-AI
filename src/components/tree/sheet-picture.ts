"use client";

// Export, picture (F9): the whole sheet as a PNG, whatever the zoom, captured in the browser with
// html-to-image (the approach in React Flow's documentation). Always in the day colours on white
// (decided in step 10), so it prints well and looks the same for everyone.
import { getNodesBounds, type Node } from "@xyflow/react";
import { toBlob } from "html-to-image";
import { PHOTO_SIZE } from "@/tree/layout/types";
import { PHOTO_PIXELS, sharperPhotoUrl } from "./photo";

const PADDING = 40;
/** Times the screen's size: names and photos stay sharp when the picture is zoomed in. */
const MAX_SCALE = 4;
/** html-to-image shrinks a canvas with a longer side than this. */
const MAX_SIDE = 16384;
/** The picture's pixels at most, on every device (owner's choice): big sheets are drawn at a lower resolution. */
const MAX_PIXELS = 64_000_000;
/**
 * Tried again with this many pixels when the browser refuses the canvas: Safari's engine, which every
 * browser on an iPhone or iPad uses, allows about 16.7 million.
 */
const FALLBACK_PIXELS = 16_000_000;
/** Used for a photo that can't be fetched, so one missing photo doesn't stop the picture. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * A PNG of every card and line on the sheet. `flow` is the React Flow element. A Blob, not a data URL:
 * a four-times picture's data URL runs to many megabytes, and Chrome on phones silently drops a
 * download that big (found by the owner, 2026-10-24).
 */
export async function sheetPicture(flow: HTMLElement, nodes: Node[]): Promise<Blob> {
  const viewport = flow.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport || nodes.length === 0) throw new Error("The sheet isn't drawn yet.");
  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + 2 * PADDING);
  const height = Math.ceil(bounds.height + 2 * PADDING);
  // Night colours come from the "dark" class on <html> and on React Flow's element (its colorMode).
  const dark = [document.documentElement, flow].filter((element) => element.classList.contains("dark"));
  const scale = pictureScale(width, height, MAX_PIXELS);
  // The cards' photos are fetched at twice their size; html-to-image copies each <img>'s address, so
  // point them at a big enough photo while the picture is made (the overlay hides the page meanwhile).
  const pixels = Math.ceil(scale) * PHOTO_SIZE;
  const photos = pixels > PHOTO_PIXELS ? sharpenPhotos(viewport, pixels) : () => {};
  dark.forEach((element) => element.classList.remove("dark"));
  const capture = (pixelRatio: number) =>
    toBlob(viewport, {
      backgroundColor: "#ffffff",
      width,
      height,
      pixelRatio,
      imagePlaceholder: BLANK,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)` },
    });
  try {
    const fallback = pictureScale(width, height, FALLBACK_PIXELS);
    if (fallback >= scale) return isPicture(await capture(scale));
    // A canvas too big for the device draws nothing: html-to-image then throws, or the PNG comes back
    // null or empty.
    const picture = await capture(scale).catch(() => null);
    return picture && picture.size > 0 ? picture : isPicture(await capture(fallback));
  } finally {
    dark.forEach((element) => element.classList.add("dark"));
    photos();
  }
}

/** How many times the screen's size a `width` × `height` sheet is drawn at, within the limits. */
export function pictureScale(width: number, height: number, maxPixels: number): number {
  return Math.min(MAX_SCALE, MAX_SIDE / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
}

/** The PNG, or an error when the browser refused to make one (a null or empty Blob). */
export function isPicture(picture: Blob | null): Blob {
  if (!picture || picture.size === 0) throw new Error("The browser couldn't make the picture.");
  return picture;
}

/** Gives every photo in `element` a `pixels`-square address, and returns what puts the old ones back. */
function sharpenPhotos(element: HTMLElement, pixels: number): () => void {
  const changed = [...element.querySelectorAll("img")].flatMap((image) => {
    const before = image.getAttribute("src");
    const after = before && sharperPhotoUrl(before, pixels);
    if (!after || after === before) return [];
    image.setAttribute("src", after);
    return [{ image, before, after }];
  });
  return () => {
    // Unless React has given the photo another address meanwhile.
    for (const { image, before, after } of changed) if (image.getAttribute("src") === after) image.setAttribute("src", before);
  };
}

/** Saves the picture as a file. */
export function downloadPicture(picture: Blob, name: string) {
  const url = URL.createObjectURL(picture);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.png`;
  link.click();
  // Phones may still be reading it after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Opens the browser's print dialog with just the picture, where "Save as PDF" makes a PDF (decided in
 * step 10: no PDF library). A hidden frame, so no pop-up blocker gets in the way.
 */
export function printPicture(picture: Blob, title: string) {
  const url = URL.createObjectURL(picture);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", width: "0", height: "0", border: "0" });
  document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.title = title;
  const style = doc.createElement("style");
  style.textContent = "@page { margin: 12mm } html, body { margin: 0 } img { width: 100%; height: auto }";
  const image = doc.createElement("img");
  image.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  image.src = url;
  doc.head.append(style);
  doc.body.append(image);
}
