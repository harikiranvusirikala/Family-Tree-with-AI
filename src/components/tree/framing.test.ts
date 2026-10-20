// @vitest-environment node
import { describe, expect, test } from "vitest";
import { CARD_HEIGHT, CARD_WIDTH } from "@/tree/layout";
import { READABLE_ZOOM, readableViewport, revealViewport } from "./framing";

const phone = { width: 390, height: 700 };
/** Where a point of the tree lands on the screen. */
const onScreen = (v: { x: number; y: number; zoom: number }, x: number, y: number) => ({ x: x * v.zoom + v.x, y: y * v.zoom + v.y });

describe("a sheet's first view on a phone", () => {
  // The sample's Cruz family sheet is about 2,300 × 900 at full size.
  const tree = { x: 0, y: 0, width: 2300, height: 900 };

  test("zoomed in, the root centred across and the tree's top row at the top", () => {
    const root = { x: 900, y: 0 };
    const view = readableViewport(tree, root, phone)!;
    expect(view.zoom).toBe(READABLE_ZOOM);
    const centre = onScreen(view, root.x + CARD_WIDTH / 2, root.y + CARD_HEIGHT / 2);
    expect(centre.x).toBeCloseTo(phone.width / 2);
    expect(onScreen(view, 0, tree.y).y).toBe(16);
  });

  test("a root with many generations above it is centred, not pushed off the bottom", () => {
    const root = { x: 900, y: 1200 };
    const view = readableViewport({ ...tree, height: 1400 }, root, phone)!;
    expect(onScreen(view, root.x + CARD_WIDTH / 2, root.y + CARD_HEIGHT / 2)).toEqual({ x: phone.width / 2, y: phone.height / 2 });
  });

  test("a small sheet that fits at that zoom is simply fitted", () => {
    expect(readableViewport({ x: 0, y: 0, width: 356, height: 150 }, { x: 0, y: 0 }, phone)).toBeNull();
  });
});

describe("keeping the selected card above the phone's panel", () => {
  const card = { x: 400, y: 300, width: CARD_WIDTH, height: CARD_HEIGHT };

  test("a card already in the visible top part stays put", () => {
    expect(revealViewport(card, { x: -250, y: -200, zoom: 0.75 }, phone)).toBeNull(); // on screen at 50, 25
  });

  test("a card under the panel moves to the middle of the part above it, at the same zoom", () => {
    const view = revealViewport(card, { x: -300, y: 0, zoom: 0.75 }, phone)!;
    expect(view.zoom).toBe(0.75);
    const centre = onScreen(view, card.x + card.width / 2, card.y + card.height / 2);
    expect(centre.x).toBeCloseTo(phone.width / 2);
    expect(centre.y).toBeCloseTo((phone.height * 0.45) / 2);
  });

  test("so does a card off the side of the screen", () => {
    expect(revealViewport(card, { x: 200, y: -200, zoom: 0.75 }, phone)).not.toBeNull();
  });

  test("on a tablet the panel covers nothing, so a low card is left where it is", () => {
    expect(revealViewport(card, { x: -250, y: 200, zoom: 0.75 }, phone, 0)).toBeNull(); // on screen at 50, 425
    expect(revealViewport(card, { x: -250, y: 200, zoom: 0.75 }, phone)).not.toBeNull();
  });
});
