import { Activity } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Menu, menuItem } from "./Menu";

afterEach(cleanup);

function Fruit({ checked }: { checked?: string }) {
  return (
    <Menu label="Fruit" button="Pick a fruit" buttonClassName="">
      {(close) =>
        ["Apple", "Banana", "Cherry"].map((name) => (
          <button key={name} type="button" role="menuitemradio" aria-checked={checked === name} onClick={close} className={menuItem}>
            {name}
          </button>
        ))
      }
    </Menu>
  );
}

const trigger = () => screen.getByRole("button", { name: "Pick a fruit" });
const item = (name: string) => screen.getByRole("menuitemradio", { name });

describe("Menu (the production look)", () => {
  test("opens on a click with its first item focused, and says so", () => {
    render(<Fruit />);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu", { name: "Fruit" })).toBeDefined();
    expect(document.activeElement).toBe(item("Apple"));
  });

  test("starts on the checked item", () => {
    render(<Fruit checked="Banana" />);
    fireEvent.click(trigger());
    expect(document.activeElement).toBe(item("Banana"));
  });

  test("arrows, Home and End move round the items", () => {
    render(<Fruit />);
    fireEvent.click(trigger());
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("Banana"));
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(item("Cherry"));
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("Apple"));
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(item("Cherry"));
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(item("Apple"));
  });

  test("Escape closes it and puts the focus back on its button", () => {
    render(<Fruit />);
    fireEvent.click(trigger());
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  test("choosing an item closes it; ArrowDown on the button opens it", () => {
    render(<Fruit />);
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.click(item("Cherry"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  test("a tap anywhere else closes it (pointerdown, which React Flow doesn't stop)", () => {
    render(
      <>
        <Fruit />
        <p>Elsewhere</p>
      </>,
    );
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("a page Next.js kept for Back (hidden by React's Activity) comes back with it closed", () => {
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <Fruit />
      </Activity>
    );
    const { rerender } = render(page("visible"));
    fireEvent.click(trigger());
    rerender(page("hidden"));
    rerender(page("visible"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
});
