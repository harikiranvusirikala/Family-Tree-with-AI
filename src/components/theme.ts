"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export type Theme = "light" | "dark";
/** What the person chose: a theme, or to follow the device ("system", which saves nothing). */
export type ThemeChoice = Theme | "system";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const darkDevice = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches; // jsdom has none

function saved(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null; // storage blocked: follow the device
  }
}

/** Puts the chosen theme, or the device's, on <html> (as THEME_SCRIPT does on page load). */
function apply() {
  document.documentElement.classList.toggle("dark", (saved() ?? (darkDevice() ? "dark" : "light")) === "dark");
  notify();
}

/** Remembers the choice in this browser ("system" forgets it) and switches every open tab. */
export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // storage blocked: the choice lasts until the page is reloaded
    if (choice !== "system") {
      document.documentElement.classList.toggle("dark", choice === "dark");
      return notify();
    }
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const device = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  // Following the device: switch when it does (e.g. automatic night mode at sunset). A saved choice wins.
  const deviceChanged = () => apply();
  // Another tab chose.
  const storageChanged = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) apply();
  };
  device?.addEventListener("change", deviceChanged);
  window.addEventListener("storage", storageChanged);
  return () => {
    listeners.delete(listener);
    device?.removeEventListener("change", deviceChanged);
    window.removeEventListener("storage", storageChanged);
  };
}

/** The theme in use (set by THEME_SCRIPT before the page appeared), or undefined on the server. */
export function useTheme(): Theme | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => undefined,
  );
}

/** What the person chose, or undefined on the server. */
export function useThemeChoice(): ThemeChoice | undefined {
  return useSyncExternalStore(subscribe, () => saved() ?? "system", () => undefined);
}
