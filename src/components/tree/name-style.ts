"use client";

import { useSyncExternalStore } from "react";
import type { NameStyle } from "@/tree/kinship";

// The Wheel's relation names (an owner request): Telugu names in English letters ("te", the default) or
// English names ("en"), remembered in this browser like the theme.
const KEY = "relation-names";
const listeners = new Set<() => void>();

function saved(): NameStyle {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "te";
  } catch {
    return "te"; // storage blocked: the default
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setNameStyle(style: NameStyle) {
  try {
    localStorage.setItem(KEY, style);
  } catch {
    // storage blocked: it lasts until the page is reloaded
    current = style;
  }
  listeners.forEach((listener) => listener());
}

let current: NameStyle | null = null;
/** The chosen style; Telugu while the server draws the page. */
export const useNameStyle = () => useSyncExternalStore(subscribe, () => current ?? saved(), () => "te" as const);
