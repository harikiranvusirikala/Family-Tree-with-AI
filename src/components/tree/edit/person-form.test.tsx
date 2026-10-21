import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { NewPerson } from "@/tree/edits";
import { DateFields, PersonFields, readMarriage, readPerson } from "./person-form";

afterEach(cleanup);

/** The form as the person fills it, then what readPerson makes of it. */
function form(defaults?: Partial<NewPerson>, who?: string) {
  render(
    <form aria-label="Person">
      <PersonFields defaults={defaults} who={who} prefix={who ? `${who.toLowerCase()}-` : ""} fixedGender={who === "Mother" ? "female" : undefined} />
    </form>,
  );
  const element = screen.getByRole("form", { name: "Person" }) as HTMLFormElement;
  const set = (name: string, value: string) => fireEvent.change(screen.getByRole(name.endsWith("month") ? "combobox" : "spinbutton", { name }), { target: { value } });
  const read = () => readPerson(new FormData(element), who ? `${who.toLowerCase()}-` : "", who);
  return { set, read };
}

describe("full dates in the person form (owner requests)", () => {
  test("a new person: only the birth's day, month and year, and Has died unchecked", () => {
    form({ name: "Asha", gender: "female" });
    expect(screen.getByRole("spinbutton", { name: "Birth day" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Birth month" })).toBeDefined();
    expect(screen.getByRole("spinbutton", { name: "Birth year" })).toBeDefined();
    expect(screen.getByRole("checkbox", { name: "Has died" })).toHaveProperty("checked", false);
    expect(screen.queryByRole("spinbutton", { name: "Death year" })).toBeNull();
  });

  test("checking Has died shows the death's fields; someone who has died starts with them", () => {
    form({ name: "Asha", gender: "female" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Has died" }));
    expect(screen.getByRole("spinbutton", { name: "Death year" })).toBeDefined();
    cleanup();
    form({ name: "Ravi", gender: "male", birthYear: 1940, deathYear: 2020, deathMonth: 12, deathDay: 1 });
    expect(screen.getByRole("checkbox", { name: "Has died" })).toHaveProperty("checked", true);
    expect((screen.getByRole("combobox", { name: "Death month" }) as HTMLSelectElement).value).toBe("12");
  });

  test("reads a full birth date, a year alone, and the death's date while Has died is checked", () => {
    const { set, read } = form({ name: "Asha", gender: "female" });
    set("Birth day", "12");
    set("Birth month", "3");
    set("Birth year", "1985");
    expect(read()).toEqual({ name: "Asha", gender: "female", birthYear: 1985, birthMonth: 3, birthDay: 12 });
    fireEvent.click(screen.getByRole("checkbox", { name: "Has died" }));
    set("Death year", "2020");
    expect(read()).toEqual({ name: "Asha", gender: "female", birthYear: 1985, birthMonth: 3, birthDay: 12, deathYear: 2020 });
  });

  test("unchecking Has died drops the death's dates, so saving clears them", () => {
    const { read } = form({ name: "Ravi", gender: "male", birthYear: 1940, deathYear: 2020, deathMonth: 12, deathDay: 1 });
    fireEvent.click(screen.getByRole("checkbox", { name: "Has died" }));
    expect(read()).toEqual({ name: "Ravi", gender: "male", birthYear: 1940 });
  });

  test("the same rules as the server: a day and month together, with a year, a real day", () => {
    const { set, read } = form({ name: "Asha", gender: "female" });
    set("Birth day", "12");
    expect(read()).toBe("Enter both the day and the month of the birth, or neither.");
    set("Birth month", "2");
    expect(read()).toBe("A birth day and month need the birth year.");
    set("Birth day", "29");
    set("Birth year", "1985");
    expect(read()).toBe("29 Feb 1985 isn't a real date.");
    set("Birth day", "40");
    expect(read()).toBe("Birth day: Enter a day from 1 to 31.");
  });

  test("a parent's labels and messages say whose", () => {
    const { set, read } = form(undefined, "Mother");
    expect(screen.getByRole("checkbox", { name: "Mother has died" })).toBeDefined();
    fireEvent.change(screen.getByRole("textbox", { name: "Mother's name" }), { target: { value: "Lakshmi" } });
    set("Mother's birth month", "5");
    expect(read()).toBe("Mother: Enter both the day and the month of the birth, or neither.");
  });
});

describe("the marriage date's fields (owner request)", () => {
  function marriage(defaults = {}) {
    render(
      <form aria-label="Marriage">
        <DateFields what="marriage" defaults={defaults} />
      </form>,
    );
    const set = (name: string, value: string) => fireEvent.change(screen.getByRole(name.endsWith("month") ? "combobox" : "spinbutton", { name }), { target: { value } });
    return { set, read: () => readMarriage(new FormData(screen.getByRole("form", { name: "Marriage" }) as HTMLFormElement)) };
  }

  test("Married on: a day, month and year, read like a birth date; empty is no date", () => {
    const { set, read } = marriage();
    expect(screen.getByRole("group", { name: "Married on" })).toBeDefined();
    expect(read()).toEqual({});
    set("Marriage year", "1985");
    expect(read()).toEqual({ marriageYear: 1985 });
    set("Marriage day", "12");
    set("Marriage month", "3");
    expect(read()).toEqual({ marriageYear: 1985, marriageMonth: 3, marriageDay: 12 });
  });

  test("the server's rules, with the field named", () => {
    const { set, read } = marriage({ marriageYear: 2023, marriageMonth: 2 });
    expect((screen.getByRole("combobox", { name: "Marriage month" }) as HTMLSelectElement).value).toBe("2");
    set("Marriage day", "29");
    expect(read()).toBe("29 Feb 2023 isn't a real date.");
    set("Marriage year", "999");
    expect(read()).toBe("Marriage year: Enter a year from 1000 on.");
    set("Marriage year", "");
    expect(read()).toBe("A marriage day and month need the marriage year.");
  });
});
