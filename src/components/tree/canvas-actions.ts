"use client";

import { createContext } from "react";

/**
 * What clicking the canvas does, if anything. Given through context rather than node data, so that
 * selecting someone doesn't lay the sheet out again. Without a provider the canvas is read-only.
 */
export interface CanvasActions {
  onPerson?: (personId: string) => void;
  onCouple?: (unionId: string) => void;
  selectedId?: string;
}

export const CanvasActionsContext = createContext<CanvasActions>({});
