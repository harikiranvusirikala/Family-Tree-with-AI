/**
 * Years shown under a person's name: "1985" if living, "1945 – 2022" if they have died.
 * Living people never show "Present" (Features.txt). Unknown years are left out.
 */
export function formatYears(birthYear?: number, deathYear?: number): string {
  if (birthYear && deathYear) return `${birthYear} – ${deathYear}`;
  if (birthYear) return String(birthYear);
  if (deathYear) return `d. ${deathYear}`;
  return "";
}
