// How the tree is framed on phones and tablets (an owner request after the final check): pure viewport
// maths, kept apart from the canvas so it can be unit-tested. A viewport is React Flow's: the screen
// position of the tree's origin, and the zoom.
import type { Rect, Viewport } from "@xyflow/react";
import { CARD_HEIGHT, CARD_WIDTH } from "@/tree/layout";
import { PHONE_PANEL_SHARE } from "../screen";

/** Names (15 px on the cards) are about 11 px at this zoom: readable, and about three cards across. */
export const READABLE_ZOOM = 0.75;
/** Space above the tree's top row in the first view. */
const TOP = 16;
/** Space kept around a card brought into view. */
const MARGIN = 8;

type Size = { width: number; height: number };

/**
 * A sheet's first view on a phone (decided by the owner) or a tablet: zoomed in so names can be read,
 * the root centred across, and the tree's top row at the top of the screen, unless that leaves the root
 * in the lower half (a root with many generations above), when the root is centred instead. Null when
 * the whole sheet fits at that zoom anyway: then it's simply fitted, as on a computer.
 */
export function readableViewport(tree: Rect, root: { x: number; y: number }, screen: Size): Viewport | null {
  if (Math.min(screen.width / tree.width, screen.height / tree.height) * 0.9 >= READABLE_ZOOM) return null;
  const zoom = READABLE_ZOOM;
  const rootX = (root.x + CARD_WIDTH / 2) * zoom;
  const rootY = (root.y + CARD_HEIGHT / 2) * zoom;
  const top = TOP - tree.y * zoom;
  return { x: screen.width / 2 - rootX, y: rootY + top <= screen.height / 2 ? top : screen.height / 2 - rootY, zoom };
}

/**
 * The viewport that moves a selected card (or heart) into view, at the same zoom, or null when it's
 * already there. `covered`: the share of the tree's height that the panel covers at the bottom, as on a
 * phone; on a tablet the panel sits beside the tree instead, which only makes it narrower.
 */
export function revealViewport(card: Rect, viewport: Viewport, screen: Size, covered = PHONE_PANEL_SHARE): Viewport | null {
  const visible = screen.height * (1 - covered);
  const { zoom } = viewport;
  const left = card.x * zoom + viewport.x;
  const top = card.y * zoom + viewport.y;
  const fits = left >= MARGIN && left + card.width * zoom <= screen.width - MARGIN && top >= MARGIN && top + card.height * zoom <= visible - MARGIN;
  if (fits) return null;
  return {
    x: screen.width / 2 - (card.x + card.width / 2) * zoom,
    y: visible / 2 - (card.y + card.height / 2) * zoom,
    zoom,
  };
}

/**
 * Find someone (★ Everyone): the viewport that centres a card, at least zoomed in far enough to read
 * names, in the part of the tree a phone's panel leaves visible (`covered`: as for revealViewport).
 */
export function focusViewport(card: Rect, viewport: Viewport, screen: Size, covered = 0): Viewport {
  const zoom = Math.max(viewport.zoom, READABLE_ZOOM);
  const visible = screen.height * (1 - covered);
  return { x: screen.width / 2 - (card.x + card.width / 2) * zoom, y: visible / 2 - (card.y + card.height / 2) * zoom, zoom };
}
