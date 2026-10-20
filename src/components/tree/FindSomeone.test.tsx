import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Person } from "@/tree/types";
import { FindSomeone } from "./FindSomeone";

afterEach(cleanup);

const persons: Person[] = [
  { id: "1", name: "Timothy Cruz", gender: "male", birthYear: 1880, deathYear: 1962 },
  { id: "2", name: "Timothy Cruz", gender: "male", birthYear: 1940, deathYear: 2020 },
  { id: "3", name: "Amelia Young", gender: "female", birthYear: 2001 },
  { id: "4", name: "Zoë Ávila", gender: "female" },
];

function setup() {
  const onChoose = vi.fn();
  render(<FindSomeone persons={persons} onChoose={onChoose} />);
  const box = screen.getByRole("combobox", { name: "Find someone" }) as HTMLInputElement;
  fireEvent.focus(box);
  return { onChoose, box };
}
const options = () => screen.queryAllByRole("option").map((o) => o.textContent);

describe("Find someone (owner request)", () => {
  test("shows the matches as you type, with years to tell people apart", () => {
    const { box } = setup();
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(box, { target: { value: "tim" } });
    expect(options()).toEqual(["Timothy Cruz (1880 – 1962)", "Timothy Cruz (1940 – 2020)"]);
    expect(box.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(box, { target: { value: "zoe" } });
    expect(options()).toEqual(["Zoë Ávila"]);
    fireEvent.change(box, { target: { value: "nobody" } });
    expect(screen.getByText("Nobody by that name.")).toBeDefined();
  });

  test("Down and Enter choose the second match, and the box empties", () => {
    const { box, onChoose } = setup();
    fireEvent.change(box, { target: { value: "timothy" } });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith("2");
    expect(box.value).toBe("");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("a tap chooses; Escape closes the list, then empties the box", () => {
    const { box, onChoose } = setup();
    fireEvent.change(box, { target: { value: "ame" } });
    fireEvent.pointerDown(screen.getByRole("option", { name: "Amelia Young (2001)" }));
    expect(onChoose).toHaveBeenCalledWith("3");

    fireEvent.change(box, { target: { value: "tim" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box.value).toBe("tim");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box.value).toBe("");
  });
});
