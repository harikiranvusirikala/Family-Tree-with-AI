// @vitest-environment node
import { describe, expect, test } from "vitest";
import { cropBetween, growCrop, isUsable, MIN_CROP, moveCrop, resizeCrop, roundCrop } from "./photo-crop";
import { photoCropSchema } from "@/server/operations/schema";

const box = { x: 0.2, y: 0.3, w: 0.4, h: 0.5 };
const close = (actual: object, expected: object) => expect(roundCrop(actual as typeof box)).toEqual(expected);

describe("the rectangle around someone in a photo (owner request)", () => {
  test("drawn in any direction, kept inside the photo", () => {
    close(cropBetween({ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.8 }), box);
    close(cropBetween({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 }), box); // dragged up and to the left
    close(cropBetween({ x: 0.5, y: 0.5 }, { x: 1.4, y: -0.2 }), { x: 0.5, y: 0, w: 0.5, h: 0.5 }); // past the edges
  });

  test("a click without a drag draws nothing", () => {
    expect(isUsable(cropBetween({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.6 }))).toBe(false);
    expect(isUsable(box)).toBe(true);
  });

  test("moved, stopping at the edges without changing size", () => {
    close(moveCrop(box, 0.1, -0.1), { x: 0.3, y: 0.2, w: 0.4, h: 0.5 });
    close(moveCrop(box, 0.9, 0.9), { x: 0.6, y: 0.5, w: 0.4, h: 0.5 });
    close(moveCrop(box, -1, -1), { x: 0, y: 0, w: 0.4, h: 0.5 });
  });

  test("resized from any corner, the opposite one staying put", () => {
    close(resizeCrop(box, "se", { x: 0.9, y: 0.9 }), { x: 0.2, y: 0.3, w: 0.7, h: 0.6 });
    close(resizeCrop(box, "nw", { x: 0.1, y: 0.1 }), { x: 0.1, y: 0.1, w: 0.5, h: 0.7 });
    close(resizeCrop(box, "ne", { x: 1.5, y: -1 }), { x: 0.2, y: 0, w: 0.8, h: 0.8 }); // stops at the edges
    close(resizeCrop(box, "sw", { x: 0, y: 0.9 }), { x: 0, y: 0.3, w: 0.6, h: 0.6 });
  });

  test("dragging a corner past the opposite one stops at the smallest size, never inside out", () => {
    const squeezed = resizeCrop(box, "se", { x: 0, y: 0 });
    close(squeezed, { x: 0.2, y: 0.3, w: MIN_CROP, h: MIN_CROP });
  });

  test("the keyboard grows and shrinks it within the photo and the smallest size", () => {
    close(growCrop(box, 0.1, 0.1), { x: 0.2, y: 0.3, w: 0.5, h: 0.6 });
    close(growCrop(box, 1, 1), { x: 0.2, y: 0.3, w: 0.8, h: 0.7 });
    close(growCrop(box, -1, -1), { x: 0.2, y: 0.3, w: MIN_CROP, h: MIN_CROP });
  });

  test("rounded for saving, and still accepted by the server for wide and tall photos alike", () => {
    const rounded = roundCrop({ x: 0.333333, y: 0.1234567, w: 0.6666671, h: 0.8765433 });
    expect(rounded).toEqual({ x: 0.3333, y: 0.1235, w: 0.6667, h: 0.8765 });
    expect(rounded.x + rounded.w).toBeLessThanOrEqual(1);
    for (const crop of [rounded, roundCrop(cropBetween({ x: 0, y: 0 }, { x: 1, y: 1 })), roundCrop(moveCrop(box, 1, 1))]) {
      expect(photoCropSchema.safeParse(crop).success).toBe(true);
    }
  });
});
