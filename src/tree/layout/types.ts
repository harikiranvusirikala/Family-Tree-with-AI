import type { SheetView } from "../types";

// Card geometry shared by the layout engines and the canvas components.
export const CARD_WIDTH = 150;
export const CARD_HEIGHT = 150;
export const PHOTO_SIZE = 84;
export const PHOTO_TOP = 8;
export const PHOTO_CENTER_Y = PHOTO_TOP + PHOTO_SIZE / 2;
/** Horizontal gap between partners; the heart sits in it. */
export const HEART_GAP = 56;
/** Vertical gap between generations; the child connectors run through it. */
export const ROW_GAP = 90;

export interface PositionedPerson {
  id: string;
  x: number; // top-left corner of the card
  y: number;
}

export interface PositionedUnion {
  id: string;
  x: number; // heart centre for couples; bottom centre of the card for a single parent
  y: number;
}

export interface LayoutLink {
  from: string;
  to: string;
  kind: "partner" | "child";
}

export interface LayoutResult {
  persons: PositionedPerson[];
  unions: PositionedUnion[];
  links: LayoutLink[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  /**
   * Every couple's children eldest first, left to right, each with their whole family (stored sheets,
   * an owner request). Without it, avoiding crossing lines comes first (★ Everyone).
   */
  strictSiblings?: boolean;
}

/** ARCHITECTURE.md §7. Async because ELK.js only offers an async API. */
export interface LayoutEngine {
  name: string;
  layout(view: SheetView, options?: LayoutOptions): Promise<LayoutResult>;
}
