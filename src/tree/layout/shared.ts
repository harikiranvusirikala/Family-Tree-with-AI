import type { SheetView } from "../types";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  HEART_GAP,
  PHOTO_CENTER_Y,
  type LayoutLink,
  type LayoutResult,
  type PositionedPerson,
  type PositionedUnion,
} from "./types";

/** Partner links (each partner to the heart) and child links (heart to each child). */
export function buildLinks(view: SheetView): LayoutLink[] {
  return view.unions.flatMap((u) => [
    ...u.partnerIds.map((p): LayoutLink => ({ from: p, to: u.id, kind: "partner" })),
    ...u.childIds.map((c): LayoutLink => ({ from: u.id, to: c, kind: "child" })),
  ]);
}

/**
 * Places every heart from the person positions, so all engines draw unions the same way.
 * A couple's heart sits in the gap between the two cards at photo height; a single parent's
 * children hang from the bottom centre of the card.
 */
export function placeUnions(view: SheetView, persons: PositionedPerson[]): PositionedUnion[] {
  const pos = new Map(persons.map((p) => [p.id, p]));
  const placed: PositionedUnion[] = [];
  for (const u of view.unions) {
    const partners = u.partnerIds.map((id) => pos.get(id)).filter((p) => p !== undefined);
    if (partners.length !== u.partnerIds.length) continue; // an engine dropped a partner
    if (partners.length === 1) {
      placed.push({ id: u.id, x: partners[0].x + CARD_WIDTH / 2, y: partners[0].y + CARD_HEIGHT });
      continue;
    }
    const [left, right] = partners[0].x <= partners[1].x ? partners : [partners[1], partners[0]];
    const adjacent = Math.abs(right.x - left.x - (CARD_WIDTH + HEART_GAP)) < 1 && left.y === right.y;
    placed.push({
      id: u.id,
      x: adjacent ? left.x + CARD_WIDTH + HEART_GAP / 2 : (left.x + right.x + CARD_WIDTH) / 2,
      y: (left.y + right.y) / 2 + PHOTO_CENTER_Y,
    });
  }
  return placed;
}

export function finishLayout(view: SheetView, persons: PositionedPerson[]): LayoutResult {
  const width = Math.max(0, ...persons.map((p) => p.x + CARD_WIDTH));
  const height = Math.max(0, ...persons.map((p) => p.y + CARD_HEIGHT));
  return { persons, unions: placeUnions(view, persons), links: buildLinks(view), width, height };
}
