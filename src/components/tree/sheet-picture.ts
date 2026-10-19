"use client";

// Export, picture (F9): the whole sheet as a PNG, whatever the zoom, captured in the browser with
// html-to-image (the approach in React Flow's documentation). Always in the day colours on white
// (decided in step 10), so it prints well and looks the same for everyone.
import { getNodesBounds, type Node } from "@xyflow/react";
import { toPng } from "html-to-image";

const PADDING = 40;
/** The picture's longest side in pixels; big sheets are drawn at a lower resolution. */
const MAX_SIDE = 8000;
/** Used for a photo that can't be fetched, so one missing photo doesn't stop the picture. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** A PNG data URL of every card and line on the sheet. `flow` is the React Flow element. */
export async function sheetPicture(flow: HTMLElement, nodes: Node[]): Promise<string> {
  const viewport = flow.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport || nodes.length === 0) throw new Error("The sheet isn't drawn yet.");
  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + 2 * PADDING);
  const height = Math.ceil(bounds.height + 2 * PADDING);
  // Night colours come from the "dark" class on <html> and on React Flow's element (its colorMode).
  const dark = [document.documentElement, flow].filter((element) => element.classList.contains("dark"));
  dark.forEach((element) => element.classList.remove("dark"));
  try {
    return await toPng(viewport, {
      backgroundColor: "#ffffff",
      width,
      height,
      pixelRatio: Math.min(2, MAX_SIDE / Math.max(width, height)),
      imagePlaceholder: BLANK,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)` },
    });
  } finally {
    dark.forEach((element) => element.classList.add("dark"));
  }
}

/** Saves the picture as a file. */
export function downloadPicture(dataUrl: string, name: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${name}.png`;
  link.click();
}

/**
 * Opens the browser's print dialog with just the picture, where "Save as PDF" makes a PDF (decided in
 * step 10: no PDF library). A hidden frame, so no pop-up blocker gets in the way.
 */
export function printPicture(dataUrl: string, title: string) {
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
    setTimeout(() => frame.remove(), 60_000);
  };
  image.src = dataUrl;
  doc.head.append(style);
  doc.body.append(image);
}
