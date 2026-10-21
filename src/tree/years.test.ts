import { describe, expect, test } from "vitest";
import { birthOrder, datesProblem, formatDate, formatLife, formatMarriage, formatYears, isRealDate, lifeDates, marriageDate, marriageOrder, marriageProblem } from "./years";

describe("formatYears", () => {
  test("living person shows only the birth year, never 'Present'", () => {
    expect(formatYears(1985)).toBe("1985");
  });
  test("person who has died shows both years with an en dash", () => {
    expect(formatYears(1945, 2022)).toBe("1945 – 2022");
  });
  test("unknown years are left out", () => {
    expect(formatYears(undefined, 2022)).toBe("d. 2022");
    expect(formatYears()).toBe("");
  });
});

describe("full dates (owner request)", () => {
  test("written 12 Mar 1985; a year alone when that's all that's known", () => {
    expect(formatDate(1985, 3, 12)).toBe("12 Mar 1985");
    expect(formatDate(1985)).toBe("1985");
    expect(formatDate()).toBe("");
    expect(formatLife({ birthYear: 1945, birthMonth: 3, birthDay: 12, deathYear: 2022, deathMonth: 6, deathDay: 3 })).toBe("12 Mar 1945 – 3 Jun 2022");
    expect(formatLife({ birthYear: 1945, birthMonth: 3, birthDay: 12, deathYear: 2022 })).toBe("12 Mar 1945 – 2022");
    expect(formatLife({ birthYear: 1985, birthMonth: 12, birthDay: 1 })).toBe("1 Dec 1985");
    expect(formatLife({ deathYear: 2022, deathMonth: 6, deathDay: 3 })).toBe("d. 3 Jun 2022");
  });

  test("real dates only: no 31 April, 29 February only in leap years", () => {
    expect([isRealDate(2024, 2, 29), isRealDate(2023, 2, 29), isRealDate(1900, 2, 29), isRealDate(2000, 2, 29), isRealDate(1985, 4, 31)]).toEqual([true, false, false, true, false]);
  });

  test("what's wrong with a person's dates", () => {
    expect(datesProblem({ birthYear: 1985, birthMonth: 3, birthDay: 12 })).toBeNull();
    expect(datesProblem({ birthYear: 1985, birthMonth: 3 })).toBe("Enter both the day and the month of the birth, or neither");
    expect(datesProblem({ birthMonth: 3, birthDay: 12 })).toBe("A birth day and month need the birth year");
    expect(datesProblem({ birthYear: 1985, birthMonth: 2, birthDay: 30 })).toBe("30 Feb 1985 isn't a real date");
    expect(datesProblem({ birthYear: 1985, deathYear: 1980 })).toBe("The death year can't be before the birth year");
    expect(datesProblem({ birthYear: 1985, birthMonth: 6, birthDay: 2, deathYear: 1985, deathMonth: 6, deathDay: 1 })).toBe("The death date can't be before the birth date");
    expect(datesProblem({ birthYear: 1985, birthMonth: 6, birthDay: 2, deathYear: 1985 })).toBeNull(); // can't tell
    expect(datesProblem({ deathYear: 2022, deathMonth: 6, deathDay: 31 })).toBe("31 Jun 2022 isn't a real date");
  });

  test("ordering by birth: a year alone before that year's dated days; nothing without a year", () => {
    const order = [{ birthYear: 1985, birthMonth: 3, birthDay: 12 }, { birthYear: 1985 }, { birthYear: 1984, birthMonth: 12, birthDay: 31 }, {}].map(birthOrder);
    expect(order).toEqual([19850312, 19850000, 19841231, undefined]);
  });

  test("the date fields that are set", () => {
    expect(lifeDates({ birthYear: 1985, birthMonth: 3, birthDay: 12, deathYear: undefined })).toEqual({ birthYear: 1985, birthMonth: 3, birthDay: 12 });
  });
});

describe("marriage dates (owner request)", () => {
  test("written like a birth date: 12 Mar 1985, or the year alone", () => {
    expect(formatMarriage({ marriageYear: 1985, marriageMonth: 3, marriageDay: 12 })).toBe("12 Mar 1985");
    expect(formatMarriage({ marriageYear: 1985 })).toBe("1985");
    expect(formatMarriage({})).toBe("");
  });

  test("the rules of a birth date: the day and month together, with their year, and real", () => {
    expect(marriageProblem({ marriageYear: 2024, marriageMonth: 2, marriageDay: 29 })).toBeNull();
    expect(marriageProblem({ marriageYear: 2010 })).toBeNull();
    expect(marriageProblem({})).toBeNull();
    expect(marriageProblem({ marriageYear: 2010, marriageMonth: 3 })).toBe("Enter both the day and the month of the marriage, or neither");
    expect(marriageProblem({ marriageMonth: 3, marriageDay: 12 })).toBe("A marriage day and month need the marriage year");
    expect(marriageProblem({ marriageYear: 2023, marriageMonth: 2, marriageDay: 29 })).toBe("29 Feb 2023 isn't a real date");
  });

  test("ordering by marriage, and the fields that are set", () => {
    expect([{ marriageYear: 1985, marriageMonth: 3, marriageDay: 12 }, { marriageYear: 1985 }, {}].map(marriageOrder)).toEqual([19850312, 19850000, undefined]);
    expect(marriageDate({ marriageYear: 1985, marriageMonth: undefined, marriageDay: undefined })).toEqual({ marriageYear: 1985 });
  });
});
