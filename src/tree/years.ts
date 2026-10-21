/**
 * Years shown under a person's name: "1985" if living, "1945 – 2022" if they have died.
 * Living people never show "Present" (FEATURES.md). Unknown years are left out.
 */
export function formatYears(birthYear?: number, deathYear?: number): string {
  if (birthYear && deathYear) return `${birthYear} – ${deathYear}`;
  if (birthYear) return String(birthYear);
  if (deathYear) return `d. ${deathYear}`;
  return "";
}

// Full birth and death dates (an owner request after the final check): a day and month, saved only
// together and only with their year. Written "12 Mar 1985" (the owner's choice).

/** A person's dates, as stored: the years, and the day and month when known. */
export interface LifeDates {
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  deathYear?: number;
  deathMonth?: number;
  deathDay?: number;
}

/** Every date field, for copying them from one shape to another. */
export const DATE_FIELDS = ["birthYear", "birthMonth", "birthDay", "deathYear", "deathMonth", "deathDay"] as const;

/** The date fields that are set. */
export function lifeDates(p: LifeDates): LifeDates {
  return Object.fromEntries(DATE_FIELDS.flatMap((key) => (p[key] === undefined ? [] : [[key, p[key]]])));
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "12 Mar 1985", or "1985" when only the year is known, or "" when nothing is. */
export function formatDate(year?: number, month?: number, day?: number): string {
  if (year === undefined) return "";
  return month !== undefined && day !== undefined ? `${day} ${MONTHS[month - 1]} ${year}` : String(year);
}

/** Like formatYears, with full dates where known: "12 Mar 1945 – 3 Jun 2022", "12 Mar 1985", "d. 2022". */
export function formatLife(p: LifeDates): string {
  const born = formatDate(p.birthYear, p.birthMonth, p.birthDay);
  const died = formatDate(p.deathYear, p.deathMonth, p.deathDay);
  if (born && died) return `${born} – ${died}`;
  return born || (died ? `d. ${died}` : "");
}

/** Whether a day exists in a month and year: no 31 April, and 29 February only in leap years. */
export function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A number that orders dates; a year alone comes before the dated days of that year. */
const dateKey = (year: number, month?: number, day?: number) => year * 10000 + (month ?? 0) * 100 + (day ?? 0);

/** For ordering by birth: eldest first. Undefined with no birth year. */
export const birthOrder = (p: LifeDates): number | undefined => (p.birthYear === undefined ? undefined : dateKey(p.birthYear, p.birthMonth, p.birthDay));

/**
 * What's wrong with a person's dates, or null: a day without its month (or the other way round), a day
 * and month without their year, a day that doesn't exist, or a death before the birth.
 */
export function datesProblem(p: LifeDates): string | null {
  for (const [what, year, month, day] of [
    ["birth", p.birthYear, p.birthMonth, p.birthDay],
    ["death", p.deathYear, p.deathMonth, p.deathDay],
  ] as const) {
    if ((month === undefined) !== (day === undefined)) return `Enter both the day and the month of the ${what}, or neither`;
    if (month !== undefined && year === undefined) return `A ${what} day and month need the ${what} year`;
    if (month !== undefined && day !== undefined && year !== undefined && !isRealDate(year, month, day)) return `${day} ${MONTHS[month - 1]} ${year} isn't a real date`;
  }
  if (p.birthYear !== undefined && p.deathYear !== undefined) {
    if (p.deathYear < p.birthYear) return "The death year can't be before the birth year";
    const bothDates = p.deathMonth !== undefined && p.birthMonth !== undefined;
    if (bothDates && dateKey(p.deathYear, p.deathMonth, p.deathDay) < dateKey(p.birthYear, p.birthMonth, p.birthDay)) return "The death date can't be before the birth date";
  }
  return null;
}
