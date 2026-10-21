"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Day } from "@/tree/upcoming";

/** This device's date, as "2026-10-21" (a string, so React sees the same value until the day changes). */
function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// Checked again when the page comes back into view: it may have been left open overnight.
function subscribe(changed: () => void) {
  document.addEventListener("visibilitychange", changed);
  window.addEventListener("focus", changed);
  return () => {
    document.removeEventListener("visibilitychange", changed);
    window.removeEventListener("focus", changed);
  };
}

/**
 * Today on this device (birthdays and anniversaries, an owner request), or null while the page is drawn
 * on the server and hydrated: the server knows neither the person's day nor their time zone.
 */
export function useToday(): Day | null {
  const key = useSyncExternalStore(subscribe, todayKey, () => null);
  return useMemo(() => {
    if (!key) return null;
    const [year, month, day] = key.split("-").map(Number);
    return { year, month, day };
  }, [key]);
}
