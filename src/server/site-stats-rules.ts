// Pure helpers for the site stats (an owner request, 2026-10-25). Days and weeks are UTC.
import type { PhotoCrop } from "@/tree/types";

const DAY = 86_400_000;

/** Midnight UTC at the start of `date`'s day. */
export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Midnight UTC on the Monday of `date`'s week. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY);
}

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY);
}

export interface WeekCount {
  /** The week's Monday, YYYY-MM-DD. */
  week: string;
  count: number;
}

/** How many of `dates` fall in each of the last `weeks` weeks (Monday to Sunday), oldest first, this week last. */
export function weeklyCounts(dates: Date[], now: Date, weeks: number): WeekCount[] {
  const thisWeek = startOfWeek(now).getTime();
  const counts = Array.from({ length: weeks }, (_, i) => ({ week: new Date(thisWeek - (weeks - 1 - i) * 7 * DAY).toISOString().slice(0, 10), count: 0 }));
  for (const date of dates) {
    const back = Math.floor((thisWeek - startOfWeek(date).getTime()) / (7 * DAY));
    if (back >= 0 && back < weeks) counts[weeks - 1 - back].count++;
  }
  return counts;
}

/** The last `days` days, YYYY-MM-DD, oldest first, today last. */
export function lastDays(now: Date, days: number): string[] {
  const today = startOfDay(now).getTime();
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10));
}

/** A group as the stats show it: the last 6 characters of its id, never its name. */
export function shortGroupId(id: string): string {
  return id.slice(-6);
}

/**
 * One person's picture, for counting photos (an owner request, 2026-10-26): a photo shared by several
 * people counts once per rectangle marked in it ("Which one is …?"), and once for everyone who uses it
 * whole. Rounded to 4 decimals, as photoUrl writes the crop, so the same rectangle always matches.
 */
export function pictureKey(photoId: string, crop?: PhotoCrop | null): string {
  if (!crop) return photoId;
  return [photoId, crop.x, crop.y, crop.w, crop.h].map((part) => (typeof part === "number" ? part.toFixed(4) : part)).join("|");
}
