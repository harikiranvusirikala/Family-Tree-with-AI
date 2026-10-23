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
// together, with or without the year (a birthday alone is fine). Written "12 Mar 1985" (the owner's
// choice), or "12 Mar" without a year. A date with no year is not a full date: it never orders anyone.

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

/** The fields among `keys` that are set. */
const setFields = <K extends string>(keys: readonly K[], o: Partial<Record<K, number>>): Partial<Record<K, number>> =>
  Object.fromEntries(keys.flatMap((key) => (o[key] === undefined ? [] : [[key, o[key]]]))) as Partial<Record<K, number>>;

/** The date fields that are set. */
export const lifeDates = (p: LifeDates): LifeDates => setFields(DATE_FIELDS, p);

// Marriage dates (an owner request after the final check): a couple's, with the same rules as a birth.

/** When a couple married, as stored: the year, and the day and month when known. */
export interface MarriageDate {
  marriageYear?: number;
  marriageMonth?: number;
  marriageDay?: number;
}

/** Every marriage date field, for copying them from one shape to another. */
export const MARRIAGE_FIELDS = ["marriageYear", "marriageMonth", "marriageDay"] as const;

/** The marriage date fields that are set. */
export const marriageDate = (u: MarriageDate): MarriageDate => setFields(MARRIAGE_FIELDS, u);

/** "12 Mar 1985", or "1985" when only the year is known, or "" when nothing is. */
export const formatMarriage = (u: MarriageDate): string => formatDate(u.marriageYear, u.marriageMonth, u.marriageDay);

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "12 Mar 1985", "1985" when only the year is known, "12 Mar" when only the day and month are, or "" when nothing is. */
export function formatDate(year?: number, month?: number, day?: number): string {
  const dayAndMonth = month !== undefined && day !== undefined ? `${day} ${MONTHS[month - 1]}` : "";
  return [dayAndMonth, year === undefined ? "" : String(year)].filter(Boolean).join(" ");
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

/** For ordering by birth: eldest first. Undefined with no birth year: a day and month alone count as no date. */
export const birthOrder = (p: LifeDates): number | undefined => (p.birthYear === undefined ? undefined : dateKey(p.birthYear, p.birthMonth, p.birthDay));

/**
 * Children as the panels list them (an owner request): eldest first by birth date, then those with no
 * birth year, A to Z. A new array.
 */
export function eldestFirst<P extends LifeDates & { name: string }>(people: P[]): P[] {
  return [...people].sort((a, b) => {
    const [x, y] = [birthOrder(a), birthOrder(b)];
    if (x !== undefined && y !== undefined && x !== y) return x - y;
    if ((x === undefined) !== (y === undefined)) return x === undefined ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

/** For ordering by marriage: earliest first. Undefined with no marriage year (a day and month alone count as no date). */
export const marriageOrder = (u: MarriageDate): number | undefined => (u.marriageYear === undefined ? undefined : dateKey(u.marriageYear, u.marriageMonth, u.marriageDay));

/** Without a year, any day that exists in some year is allowed. */
const LEAP_YEAR = 2000;

/** What's wrong with one date, or null: a day without its month (or the other way round), or a day that doesn't exist (29 February is allowed without a year). */
function dateProblem(what: string, year?: number, month?: number, day?: number): string | null {
  if ((month === undefined) !== (day === undefined)) return `Enter both the day and the month of the ${what}, or neither`;
  if (month !== undefined && day !== undefined && !isRealDate(year ?? LEAP_YEAR, month, day)) return `${formatDate(year, month, day)} isn't a real date`;
  return null;
}

/** What's wrong with a couple's marriage date, or null (the rules of a birth date). */
export const marriageProblem = (u: MarriageDate): string | null => dateProblem("marriage", u.marriageYear, u.marriageMonth, u.marriageDay);

/** What's wrong with a person's dates, or null: either date's own problem, or a death before the birth. */
export function datesProblem(p: LifeDates): string | null {
  const problem = dateProblem("birth", p.birthYear, p.birthMonth, p.birthDay) ?? dateProblem("death", p.deathYear, p.deathMonth, p.deathDay);
  if (problem) return problem;
  if (p.birthYear !== undefined && p.deathYear !== undefined) {
    if (p.deathYear < p.birthYear) return "The death year can't be before the birth year";
    const bothDates = p.deathMonth !== undefined && p.birthMonth !== undefined;
    if (bothDates && dateKey(p.deathYear, p.deathMonth, p.deathDay) < dateKey(p.birthYear, p.birthMonth, p.birthDay)) return "The death date can't be before the birth date";
  }
  return null;
}
