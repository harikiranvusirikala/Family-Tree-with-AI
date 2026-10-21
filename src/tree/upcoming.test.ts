// @vitest-environment node
import { describe, expect, test } from "vitest";
import { applyPlan, sampleState, toGroupTree } from "@test/planning";
import type { Operation } from "@/server/operations/schema";
import type { GroupTree } from "./types";
import { ageText, datedFamily, formatDay, formatInDays, formatMonth, ordinal, upcomingDates, type Day, type Upcoming } from "./upcoming";

const start = sampleState();
const plain = toGroupTree(start);
const idOf = (t: GroupTree, name: string) => t.persons.find((p) => p.name === name)!.id;
const coupleOf = (t: GroupTree, a: string, b: string) => t.unions.find((u) => u.partnerIds.includes(idOf(t, a)) && u.partnerIds.includes(idOf(t, b)))!.id;
const born = (name: string, birthMonth: number, birthDay: number): Operation => ({ op: "updatePerson", personId: idOf(plain, name), set: { birthMonth, birthDay } });

// The sample family has only birth years. Some full birth dates; Steve and Arham married on 8 Sep 2008
// (in the sample), Jake and Taylor on 14 Jun 1972 (but Jake has died).
const tree = toGroupTree(
  applyPlan(start, [
    born("Steve Cruz", 10, 21), // 1985: today, turns 41
    born("Amelia Young", 10, 22), // 2001: tomorrow, turns 25
    born("Arham Chopra", 11, 3), // 1983
    born("Alex Cruz", 1, 5), // 2021: after the new year, turns 6
    born("Taylor Humes", 10, 1), // 1955: earlier this month, so next year, turns 72
    born("Jake Cruz", 10, 25), // died in 2022: no birthday
  ]),
);
const today: Day = { year: 2026, month: 10, day: 21 };
const describeEvent = (e: Upcoming) =>
  e.kind === "birthday" ? `${formatDay(e.date)} ${e.date.year}: ${e.person.name} turns ${e.age}` : `${formatDay(e.date)} ${e.date.year}: ${e.partners.map((p) => p.name).join(" & ")}, ${ordinal(e.years)}`;

describe("upcoming birthdays and anniversaries (owner request)", () => {
  test("nearest first over the next 12 months, today included, across the new year", () => {
    const { events, withoutDate } = upcomingDates(tree, today);
    expect(events.map(describeEvent)).toEqual([
      "Wed 21 Oct 2026: Steve Cruz turns 41",
      "Thu 22 Oct 2026: Amelia Young turns 25",
      "Tue 3 Nov 2026: Arham Chopra turns 43",
      "Tue 5 Jan 2027: Alex Cruz turns 6",
      "Wed 8 Sep 2027: Steve Cruz & Arham Chopra, 19th",
      "Fri 1 Oct 2027: Taylor Humes turns 72",
    ]);
    expect(events.map((e) => e.inDays)).toEqual([0, 1, 13, 76, 322, 345]);
    expect(withoutDate).toBe(25 - 5); // living people without a full birth date
  });

  test("the next 30 days only, for the dashboard; datedFamily keeps just what it needs", () => {
    expect(upcomingDates(tree, today, 30).events.map(describeEvent)).toEqual(["Wed 21 Oct 2026: Steve Cruz turns 41", "Thu 22 Oct 2026: Amelia Young turns 25", "Tue 3 Nov 2026: Arham Chopra turns 43"]);
    const dated = datedFamily(tree);
    expect(dated.persons.map((p) => p.name).sort()).toEqual(["Alex Cruz", "Amelia Young", "Arham Chopra", "Steve Cruz", "Taylor Humes"]);
    expect(dated.unions.map((u) => u.id)).toEqual([coupleOf(tree, "Steve Cruz", "Arham Chopra")]);
    expect(upcomingDates(dated, today).events.map(describeEvent)).toEqual(upcomingDates(tree, today).events.map(describeEvent));
  });

  test("left out: no full date, someone who died, a divorced couple, a couple with a partner who died", () => {
    const names = (t: GroupTree) => upcomingDates(t, today).events.map((e) => (e.kind === "birthday" ? e.person.name : e.partners.map((p) => p.name).join(" & ")));
    expect(names(tree)).not.toContain("Jake Cruz"); // died
    expect(names(tree)).not.toContain("Jake Cruz & Taylor Humes"); // Jake died
    const divorced = toGroupTree(applyPlan(start, [{ op: "updateUnion", unionId: coupleOf(plain, "Steve Cruz", "Arham Chopra"), set: { status: "divorced" } }]));
    expect(names(divorced)).toEqual([]); // and nobody else has a full date in the plain sample
    const yearOnly = toGroupTree(applyPlan(start, [{ op: "updateUnion", unionId: coupleOf(plain, "Steve Cruz", "Arham Chopra"), set: { marriageMonth: null, marriageDay: null } }]));
    expect(names(yearOnly)).toEqual([]);
  });

  test("29 February falls on the 28th in other years, and on the 29th in leap years", () => {
    const leapling = toGroupTree(applyPlan(start, [{ op: "updatePerson", personId: idOf(plain, "Anna Cruz"), set: { birthYear: 2012, birthMonth: 2, birthDay: 29 } }]));
    expect(upcomingDates(leapling, today).events.map(describeEvent)).toContain("Sun 28 Feb 2027: Anna Cruz turns 15");
    expect(upcomingDates(leapling, { year: 2027, month: 3, day: 1 }).events.map(describeEvent)).toContain("Tue 29 Feb 2028: Anna Cruz turns 16");
  });

  test("born or married today: the first is a year from now", () => {
    const baby = { id: "b".repeat(24), name: "New Baby", gender: "female" as const, birthYear: 2026, birthMonth: 10, birthDay: 21 };
    const later = { id: "c".repeat(24), name: "Due Later", gender: "male" as const, birthYear: 2026, birthMonth: 12, birthDay: 1 };
    const { events } = upcomingDates({ persons: [baby, later], unions: [] }, today);
    expect(events.map(describeEvent)).toEqual(["Thu 21 Oct 2027: New Baby turns 1", "Wed 1 Dec 2027: Due Later turns 1"]);
    expect(events.find((e) => e.kind === "birthday" && e.person.name === "New Baby")!.inDays).toBe(365);
  });

  test("milestones: a 60th birthday (Shashtipurti), 25th and 50th anniversaries", () => {
    const marked = toGroupTree(
      applyPlan(start, [
        { op: "updatePerson", personId: idOf(plain, "Christina Cruz"), set: { birthYear: 1966, birthMonth: 12, birthDay: 2 } },
        { op: "updateUnion", unionId: coupleOf(plain, "Steve Cruz", "Arham Chopra"), set: { marriageYear: 2002 } },
        { op: "updateUnion", unionId: coupleOf(plain, "Olivia Cruz", "Arjun Patel"), set: { marriageYear: 1977, marriageMonth: 5, marriageDay: 1 } },
      ]),
    );
    const milestones = upcomingDates(marked, today).events.flatMap((e) => (e.milestone ? [`${describeEvent(e)} (${e.milestone})`] : []));
    expect(milestones).toEqual([
      "Wed 2 Dec 2026: Christina Cruz turns 60 (Shashtipurti)",
      "Sat 1 May 2027: Olivia Cruz & Arjun Patel, 50th (Golden)",
      "Wed 8 Sep 2027: Steve Cruz & Arham Chopra, 25th (Silver)",
    ]);
  });
});

describe("words for dates and ages", () => {
  test("ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 52, 101, 111, 112].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "52nd", "101st", "111th", "112th"]);
  });

  test("days, how soon, months", () => {
    expect(formatDay({ year: 2027, month: 6, day: 14 })).toBe("Mon 14 Jun");
    expect([0, 1, 5].map(formatInDays)).toEqual(["Today", "Tomorrow", "In 5 days"]);
    expect(formatMonth({ year: 2027, month: 6, day: 14 })).toBe("June 2027");
  });

  test("ages: exact with a full date, about with a year, at death", () => {
    const p = (fields: object) => ({ id: "x", name: "X", gender: "male" as const, ...fields });
    expect(ageText(p({ birthYear: 1985, birthMonth: 10, birthDay: 21 }), today)).toBe("41 years old"); // today's birthday
    expect(ageText(p({ birthYear: 1985, birthMonth: 10, birthDay: 22 }), today)).toBe("40 years old");
    expect(ageText(p({ birthYear: 2025, birthMonth: 10, birthDay: 21 }), today)).toBe("1 year old");
    expect(ageText(p({ birthYear: 2026, birthMonth: 1, birthDay: 1 }), today)).toBe("Under a year old");
    expect(ageText(p({ birthYear: 1985 }), today)).toBe("About 41 years old");
    expect(ageText(p({ birthYear: 1945, birthMonth: 3, birthDay: 12, deathYear: 2022, deathMonth: 3, deathDay: 11 }), today)).toBe("Died aged 76");
    expect(ageText(p({ birthYear: 1945, deathYear: 2022 }), today)).toBe("Died aged about 77");
    expect(ageText(p({ deathYear: 2022 }), today)).toBe("");
    expect(ageText(p({}), today)).toBe("");
  });
});
