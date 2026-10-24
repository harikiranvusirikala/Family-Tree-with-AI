// @vitest-environment node
import { describe, expect, test } from "vitest";
import { isPicture, pictureScale } from "./sheet-picture";

describe("the exported picture's resolution", () => {
  test("a sheet of usual size is drawn at four times the screen's size, so names and photos stay sharp", () => {
    expect(pictureScale(2131, 1430, 64_000_000)).toBe(4);
  });

  test("a big sheet is drawn smaller, within the pixel budget and html-to-image's longest side", () => {
    expect(pictureScale(4000, 2000, 64_000_000)).toBeCloseTo(Math.sqrt(8), 5);
    expect(pictureScale(4000, 2000, 64_000_000) ** 2 * 4000 * 2000).toBeCloseTo(64_000_000, -2);
    expect(pictureScale(8000, 400, 64_000_000)).toBe(16384 / 8000);
  });

  test("a device that refuses the big canvas gets one of 16 million pixels", () => {
    expect(pictureScale(2131, 1430, 16_000_000)).toBeCloseTo(Math.sqrt(16_000_000 / (2131 * 1430)), 5);
  });

  test("a refused canvas is noticed: no PNG, or an empty one", () => {
    expect(() => isPicture(null)).toThrow("couldn't make the picture");
    expect(() => isPicture(new Blob([]))).toThrow("couldn't make the picture");
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    expect(isPicture(png)).toBe(png);
  });
});
