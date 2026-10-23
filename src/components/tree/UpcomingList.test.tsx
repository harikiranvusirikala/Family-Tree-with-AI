import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { FamilyData } from "@/tree/types";
import { UpcomingList } from "./UpcomingList";

afterEach(cleanup);

// Steve's birthday is today; Asha turns 60 next month; Steve and Arham married on 8 Sep 2008; Ravi has
// only a birth year.
const family: FamilyData = {
  persons: [
    { id: "steve", name: "Steve Cruz", gender: "male", birthYear: 1985, birthMonth: 10, birthDay: 21 },
    { id: "arham", name: "Arham Chopra", gender: "female", birthYear: 1983 },
    { id: "asha", name: "Asha Rao", gender: "female", birthYear: 1966, birthMonth: 11, birthDay: 2 },
    { id: "ravi", name: "Ravi Rao", gender: "male", birthYear: 1964 },
  ],
  unions: [{ id: "steve-arham", partnerIds: ["steve", "arham"], status: "married", marriageYear: 2008, marriageMonth: 9, marriageDay: 8, childIds: [] }],
};
const today = { year: 2026, month: 10, day: 21 };

function upcoming(selectedId?: string, data = family) {
  const calls = { onPerson: vi.fn(), onCouple: vi.fn() };
  render(<UpcomingList family={data} today={today} selectedId={selectedId} {...calls} />);
  return calls;
}
const rows = () => screen.getAllByTestId("upcoming-row");

describe("★ Everyone's Upcoming (owner request)", () => {
  test("nearest first, by month, with how soon, ages, anniversaries and milestones", () => {
    upcoming();
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["October 2026", "November 2026", "September 2027"]);
    expect(rows().map((r) => r.textContent)).toEqual([
      "Wed 21 OctTodaySCSteve CruzTurns 41",
      "Mon 2 NovIn 12 daysARAsha RaoTurns 60Shashtipurti",
      "Wed 8 SepSCACSteve Cruz & Arham Chopra19th anniversary",
    ]);
    expect(screen.getByText("2 living people have no birthday (day and month) saved, so their birthdays aren't shown.")).toBeDefined(); // Arham and Ravi
  });

  test("a birthday chooses the person, an anniversary the couple; named like their card and heart", () => {
    const { onPerson, onCouple } = upcoming();
    fireEvent.click(screen.getByRole("button", { name: "Steve Cruz, 1985" }));
    expect(onPerson).toHaveBeenCalledWith("steve");
    fireEvent.click(rows()[2]);
    expect(onCouple).toHaveBeenCalledWith("steve-arham");
    expect(within(rows()[2]).getByRole("button", { name: "Steve Cruz and Arham Chopra, married" })).toBeDefined();
  });

  test("the chosen row is marked and scrolled into view", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled; // jsdom has none
    try {
      upcoming("steve-arham");
      expect(rows().map((r) => r.getAttribute("aria-current"))).toEqual([null, null, "true"]);
      expect(scrolled.mock.contexts[0]).toBe(rows()[2]);
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  test("nothing to show: says how to add dates", () => {
    upcoming(undefined, { persons: [family.persons[3]], unions: [] });
    expect(screen.queryAllByTestId("upcoming-row")).toHaveLength(0);
    expect(screen.getByText(/No birthdays or anniversaries to show yet/)).toBeDefined();
    expect(screen.getByText("1 living person has no birthday (day and month) saved, so their birthday isn't shown.")).toBeDefined();
  });
});
