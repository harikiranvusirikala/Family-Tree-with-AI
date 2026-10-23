// Birthdays and anniversaries (an owner request after the final check): whose day comes next, and how
// old someone is. Pure: "today" is given (the device's date, worked out in the browser), so tests can
// pick any day.
import { byName } from "./everyone";
import type { FamilyData, Person, Union } from "./types";
import { isRealDate, MONTHS } from "./years";

/** A day in the calendar, with no time or time zone. */
export interface Day {
  year: number;
  month: number; // 1–12
  day: number;
}

interface Dated {
  date: Day;
  /** 0 for today. */
  inDays: number;
  /** "Shashtipurti" (a 60th birthday), "Silver" (a 25th anniversary) or "Golden" (a 50th). */
  milestone?: string;
}

export type Upcoming =
  | (Dated & { kind: "birthday"; person: Person; age?: number })
  | (Dated & { kind: "anniversary"; union: Union; partners: [Person, Person]; years?: number });

const BIRTHDAY_MILESTONES: Record<number, string> = { 60: "Shashtipurti" };
const ANNIVERSARY_MILESTONES: Record<number, string> = { 25: "Silver", 50: "Golden" };

const DAY_MS = 24 * 60 * 60 * 1000;
const utc = (d: Day) => Date.UTC(d.year, d.month - 1, d.day);

/** A day and month in a given year; 29 February is the 28th in other years. */
function inYear(year: number, month: number, day: number): Day {
  return isRealDate(year, month, day) ? { year, month, day } : { year, month, day: day - 1 };
}

/**
 * The next time a day and month comes round, today included, with how many years it has been since
 * `since` then. A first time (a year after a birth or a wedding) is never today: someone born or married
 * today is 1 a year from now.
 */
function next(today: Day, since: number | undefined, month: number, day: number): { date: Day; years?: number } | null {
  const thisYear = inYear(today.year, month, day);
  // With no year (a day and month alone) it simply comes round, and there is no age or count of years.
  if (since === undefined) return { date: utc(thisYear) >= utc(today) ? thisYear : inYear(today.year + 1, month, day) };
  const date = utc(thisYear) >= utc(today) && today.year > since ? thisYear : inYear(today.year + 1, month, day);
  const years = date.year - since;
  return years >= 1 ? { date, years } : null; // a date in the future: nothing to celebrate yet
}

/**
 * Everyone's next birthday and every couple's next wedding anniversary, nearest first: within the
 * next 12 months, or the next `withinDays` days. Living people with a birth day and month; married couples
 * (not divorced) with a marriage day and month and both partners living. Without a year there is no age
 * or count of years. `withoutDate` counts the living
 * people with no full birth date, who can't be shown.
 */
export function upcomingDates(family: FamilyData, today: Day, withinDays?: number): { events: Upcoming[]; withoutDate: number } {
  const byId = new Map(family.persons.map((p) => [p.id, p]));
  const living = family.persons.filter((p) => p.deathYear === undefined);
  const inDays = (date: Day) => Math.round((utc(date) - utc(today)) / DAY_MS);
  const events: Upcoming[] = [];
  for (const person of living) {
    if (person.birthMonth === undefined || person.birthDay === undefined) continue;
    const found = next(today, person.birthYear, person.birthMonth, person.birthDay);
    if (found) events.push({ kind: "birthday", person, age: found.years, date: found.date, inDays: inDays(found.date), milestone: found.years === undefined ? undefined : BIRTHDAY_MILESTONES[found.years] });
  }
  for (const union of family.unions) {
    if (union.status !== "married" || union.partnerIds.length !== 2) continue;
    if (union.marriageMonth === undefined || union.marriageDay === undefined) continue;
    const partners = union.partnerIds.map((id) => byId.get(id));
    if (partners.some((p) => !p || p.deathYear !== undefined)) continue;
    const found = next(today, union.marriageYear, union.marriageMonth, union.marriageDay);
    if (found) {
      events.push({
        kind: "anniversary",
        union,
        partners: partners as [Person, Person],
        years: found.years,
        date: found.date,
        inDays: inDays(found.date),
        milestone: found.years === undefined ? undefined : ANNIVERSARY_MILESTONES[found.years],
      });
    }
  }
  const first = (e: Upcoming) => (e.kind === "birthday" ? e.person : e.partners[0]);
  const shown = events.filter((e) => withinDays === undefined || e.inDays < withinDays);
  shown.sort((a, b) => a.inDays - b.inDays || Number(a.kind === "anniversary") - Number(b.kind === "anniversary") || byName(first(a), first(b)));
  return { events: shown, withoutDate: living.filter((p) => p.birthDay === undefined).length };
}

/**
 * Only what upcomingDates needs, for sending to the dashboard: living people with a full birth date,
 * and dated married couples whose partners are both living (with those partners).
 */
export function datedFamily(family: FamilyData): FamilyData {
  const living = new Map(family.persons.filter((p) => p.deathYear === undefined).map((p) => [p.id, p]));
  const unions = family.unions.filter((u) => u.status === "married" && u.marriageDay !== undefined && u.partnerIds.length === 2 && u.partnerIds.every((id) => living.has(id)));
  const keep = new Set([...[...living.values()].filter((p) => p.birthDay !== undefined).map((p) => p.id), ...unions.flatMap((u) => u.partnerIds)]);
  return { persons: [...living.values()].filter((p) => keep.has(p.id)), unions };
}

/** "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "52nd", "111th". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Sat 14 Jun". */
export const formatDay = (d: Day) => `${WEEKDAYS[new Date(utc(d)).getUTCDay()]} ${d.day} ${MONTHS[d.month - 1]}`;
/** "Today", "Tomorrow", "In 5 days". */
export const formatInDays = (n: number) => (n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`);
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "June 2027": the List's month headings. */
export const formatMonth = (d: Day) => `${MONTH_NAMES[d.month - 1]} ${d.year}`;

/** Whole years from one day to another: the age reached on `to`. */
function yearsBetween(from: Day, to: Day): number {
  const before = to.month < from.month || (to.month === from.month && to.day < from.day);
  return to.year - from.year - Number(before);
}

/**
 * The person panel's age: "41 years old", "About 41 years old" with only a birth year, "Under a year
 * old" for a baby; for someone who has died, "Died aged 77", or "Died aged about 77" without both full
 * dates. Empty without a birth year.
 */
export function ageText(p: Person, today: Day): string {
  if (p.birthYear === undefined) return "";
  const born = p.birthMonth !== undefined && p.birthDay !== undefined ? { year: p.birthYear, month: p.birthMonth, day: p.birthDay } : undefined;
  if (p.deathYear !== undefined) {
    const died = p.deathMonth !== undefined && p.deathDay !== undefined ? { year: p.deathYear, month: p.deathMonth, day: p.deathDay } : undefined;
    return born && died ? `Died aged ${yearsBetween(born, died)}` : `Died aged about ${p.deathYear - p.birthYear}`;
  }
  const age = born ? yearsBetween(born, today) : today.year - p.birthYear;
  if (age < 0) return "";
  if (!born) return `About ${age} ${age === 1 ? "year" : "years"} old`;
  return age === 0 ? "Under a year old" : `${age} ${age === 1 ? "year" : "years"} old`;
}
