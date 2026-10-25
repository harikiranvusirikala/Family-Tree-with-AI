// @vitest-environment node
import { describe, expect, test } from "vitest";
import { CARD_HEIGHT, CARD_WIDTH } from "@/tree/layout";
import { READABLE_ZOOM, focusViewport, readableViewport, revealViewport, wheelRevealBounds } from "./framing";

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

describe("Find someone: centring their card (owner request)", () => {
  const card = { x: 900, y: 600, width: CARD_WIDTH, height: CARD_HEIGHT };

  test("zoomed in to a readable size when the whole tree was showing, and centred", () => {
    const view = focusViewport(card, { x: 0, y: 0, zoom: 0.3 }, { width: 1100, height: 700 });
    expect(view.zoom).toBe(READABLE_ZOOM);
    const centre = onScreen(view, card.x + card.width / 2, card.y + card.height / 2);
    expect(centre).toEqual({ x: 550, y: 350 });
  });

  test("keeps a closer zoom, and on a phone centres in the part above the panel", () => {
    const view = focusViewport(card, { x: 0, y: 0, zoom: 1.2 }, phone, 0.55);
    expect(view.zoom).toBe(1.2);
    const centre = onScreen(view, card.x + card.width / 2, card.y + card.height / 2);
    expect(centre.x).toBeCloseTo(phone.width / 2);
    expect(centre.y).toBeCloseTo((phone.height * 0.45) / 2);
  });
});

describe("the Wheel's Find a relative: zooming out to their ring (owner request)", () => {
  test("a square around the middle that holds their circle and name, with a margin", () => {
    // Someone below and left of the middle: their name's bottom edge is the furthest point.
    const card = { x: -200, y: 200, width: 124, height: 96 };
    const bounds = wheelRevealBounds(card);
    expect(bounds).toEqual({ x: -304, y: -304, width: 608, height: 608 });
    expect(bounds.x + bounds.width / 2).toBe(0); // the middle stays centred
    expect(bounds.x).toBeLessThan(card.x);
    expect(bounds.y + bounds.height).toBeGreaterThan(card.y + card.height);
  });
});
