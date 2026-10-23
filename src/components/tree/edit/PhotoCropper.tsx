"use client";

import { useContext, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CORNERS, cropBetween, growCrop, isUsable, MIDDLE_CROP, moveCrop, resizeCrop, type Corner, type Point } from "@/tree/photo-crop";
import type { PhotoCrop } from "@/tree/types";
import { CloudNameContext, wholePhotoUrl } from "../photo";

/** The whole photo is shown at most this big: sharp enough to see faces in a group photo. */
const SHOWN_PIXELS = 1200;
/** How far an arrow key moves or resizes the rectangle, as a fraction of the photo. */
const STEP = 0.01;

type Drag = { kind: "draw"; from: Point } | { kind: "move"; from: Point; start: PhotoCrop } | { kind: "resize"; corner: Corner; start: PhotoCrop };

const CORNER_PLACE: Record<Corner, string> = {
  nw: "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  ne: "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
};

/**
 * The whole photo, with the rectangle around the person (an owner request): drag on the photo to draw
 * it, inside it to move it, at a corner to resize it. The keyboard works too: the arrows move it
 * (starting with the middle of the photo), Shift and the arrows resize it. Outside the rectangle is
 * dimmed. Everything is in fractions of the photo, as `photoCrop` is saved.
 */
export function PhotoCropper({ photoId, name, crop, onChange }: { photoId: string; name: string; crop: PhotoCrop | null; onChange: (crop: PhotoCrop | null) => void }) {
  const cloudName = useContext(CloudNameContext);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [loaded, setLoaded] = useState(false);
  const hintId = useId();

  const pointAt = (event: PointerEvent): Point => {
    const r = box.current!.getBoundingClientRect();
    return { x: (event.clientX - r.left) / r.width, y: (event.clientY - r.top) / r.height };
  };

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!loaded || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = pointAt(event);
    const corner = (event.target as HTMLElement).closest<HTMLElement>("[data-corner]")?.dataset.corner as Corner | undefined;
    if (crop && corner) drag.current = { kind: "resize", corner, start: crop };
    else if (crop && at.x >= crop.x && at.x <= crop.x + crop.w && at.y >= crop.y && at.y <= crop.y + crop.h) drag.current = { kind: "move", from: at, start: crop };
    else drag.current = { kind: "draw", from: at };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const at = pointAt(event);
    if (d.kind === "resize") onChange(resizeCrop(d.start, d.corner, at));
    else if (d.kind === "move") onChange(moveCrop(d.start, at.x - d.from.x, at.y - d.from.y));
    else {
      const drawn = cropBetween(d.from, at);
      if (isUsable(drawn)) onChange(drawn); // a click without a drag keeps the rectangle there was
    }
  }

  const onPointerUp = () => {
    drag.current = null;
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const move = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[event.key];
    if (!move || !loaded) return;
    event.preventDefault();
    if (!crop) return onChange(MIDDLE_CROP);
    onChange(event.shiftKey ? growCrop(crop, move[0], move[1]) : moveCrop(crop, move[0], move[1]));
  }

  if (!cloudName) return null;
  const percent = (n: number) => `${n * 100}%`;
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={box}
        role="group"
        tabIndex={0}
        aria-label={`The photo: where is ${name}?`}
        aria-describedby={hintId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative max-w-full touch-none overflow-hidden rounded-lg bg-zinc-100 outline-none select-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 dark:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
        style={{ cursor: loaded ? "crosshair" : undefined }}
      >
        {/* A plain <img>, like PersonPhoto: Cloudinary resizes (and turns HEIC into something every browser shows). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wholePhotoUrl(cloudName, photoId, SHOWN_PIXELS)}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={`block max-h-[55dvh] max-w-full ${loaded ? "" : "min-h-48 min-w-64"}`}
        />
        {crop && (
          <div
            data-testid="photo-crop"
            className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(9,9,11,0.55)] outline outline-1 outline-zinc-900/40"
            style={{ left: percent(crop.x), top: percent(crop.y), width: percent(crop.w), height: percent(crop.h) }}
          >
            {CORNERS.map((corner) => (
              <span key={corner} data-corner={corner} aria-hidden className={`absolute flex size-7 items-center justify-center pointer-coarse:size-11 ${CORNER_PLACE[corner]}`}>
                <span className="size-3 rounded-sm border-2 border-zinc-900 bg-white" />
              </span>
            ))}
          </div>
        )}
      </div>
      <p id={hintId} className="text-center text-[13px] text-zinc-500 dark:text-zinc-400">
        {crop ? "Drag the rectangle to move it, or a corner to resize it." : `Drag on the photo to draw a rectangle around ${name}.`}
        <span className="pointer-coarse:hidden"> With a keyboard: the arrow keys, and Shift to resize.</span>
      </p>
    </div>
  );
}
