import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { GroupTree } from "@/tree/types";
import { SheetTabs } from "./SheetTabs";

afterEach(cleanup);

// jsdom applies no CSS, so the tabs (tablets and up) and the picker (phones) are both in the page here.
const tree: GroupTree = {
  persons: [
    { id: "alexander", name: "Alexander Cruz", gender: "male" },
    { id: "jerry", name: "Jerry Willow", gender: "male" },
    { id: "emma", name: "Emma Young", gender: "female" },
  ],
  unions: [{ id: "u", partnerIds: ["alexander", "jerry"], status: "married", childIds: [] }],
  sheets: [
    { id: "emma-tab", title: "Emma Young's family", rootPersonId: "emma", extraPersonIds: [], pinned: false, order: 0 },
    { id: "jerry-tab", title: "Jerry Willow's family", rootPersonId: "jerry", extraPersonIds: [], pinned: true, order: 1 },
    { id: "cruz-tab", title: "Cruz family", rootPersonId: "alexander", extraPersonIds: [], pinned: true, order: 0 },
  ],
};
const sheets = [tree.sheets[2], tree.sheets[1], tree.sheets[0]]; // tab order: pinned first

function tabs(canEdit: boolean, everyone = false, menuItems: ReactNode = <button type="button" role="menuitem">Picture (PNG)</button>) {
  const onOpen = vi.fn();
  render(
    <SheetTabs
      tree={tree}
      sheets={sheets}
      current={sheets[0]}
      canEdit={canEdit}
      pending={false}
      run={async () => null}
      onOpen={onOpen}
      beforeMenu={<button type="button">Hide photos</button>}
      menuItems={menuItems}
      everyone={everyone}
    />,
  );
  return onOpen;
}

const openMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: "Sheet menu" }));
  return screen.getByRole("menu", { name: "Sheet menu" });
};
const items = (menu: HTMLElement) => within(menu).getAllByRole("menuitem").map((item) => item.textContent);

describe("the sheet row on phones and tablets (owner request)", () => {
  test("a phone's sheet picker lists the sheets in tab order, pinned ones first, and opens the one chosen", () => {
    const onOpen = tabs(false);
    const picker = screen.getByRole("combobox", { name: "Sheet" }) as HTMLSelectElement;
    expect(picker.value).toBe("cruz-tab");
    expect([...picker.querySelectorAll("optgroup")].map((g) => [g.label, [...g.querySelectorAll("option")].map((o) => o.textContent)])).toEqual([
      ["Pinned", ["Cruz family", "Jerry Willow's family"]],
      ["Other sheets", ["Emma Young's family"]],
    ]);
    fireEvent.change(picker, { target: { value: "emma-tab" } });
    expect(onOpen).toHaveBeenCalledWith("emma-tab");
  });

  test("the eye comes just before the sheet menu, outside it", () => {
    tabs(false);
    const eye = screen.getByRole("button", { name: "Hide photos" });
    const menuButton = screen.getByRole("button", { name: "Sheet menu" });
    expect(eye.compareDocumentPosition(menuButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(openMenu()).queryByText("Hide photos")).toBeNull();
  });

  test("the sheet menu has the sheet's options for Maintain and up, then the tools", () => {
    tabs(true);
    const menu = openMenu();
    expect(items(menu)).toEqual(["Rename", "Unpin", "Move upMove left", "Move downMove right", "Delete sheet", "+ New sheet", "Picture (PNG)"]);
  });

  test("a Viewer's sheet menu has only the tools", () => {
    tabs(false);
    expect(items(openMenu())).toEqual(["Picture (PNG)"]);
  });

  test("choosing an item closes the menu; Rename then shows its form", () => {
    tabs(true);
    fireEvent.click(within(openMenu()).getByRole("menuitem", { name: "Picture (PNG)" }));
    expect(screen.queryByRole("menu", { name: "Sheet menu" })).toBeNull();
    fireEvent.click(within(openMenu()).getByRole("menuitem", { name: "Rename" }));
    expect(screen.queryByRole("menu", { name: "Sheet menu" })).toBeNull();
    expect(screen.getByRole("form", { name: "Rename sheet" })).toBeDefined();
  });
});

describe("★ Everyone in the sheet row (owner request)", () => {
  test("first in the tabs and in the phone's picker, before the pinned sheets", () => {
    const onOpen = tabs(true);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["★ Everyone", "Cruz family", "Jerry Willow's family", "Emma Young's family"]);
    const picker = screen.getByRole("combobox", { name: "Sheet" }) as HTMLSelectElement;
    expect(picker.options[0].textContent).toBe("★ Everyone");
    fireEvent.click(screen.getByRole("tab", { name: "★ Everyone" }));
    expect(onOpen).toHaveBeenLastCalledWith("everyone");
    fireEvent.change(picker, { target: { value: "everyone" } });
    expect(onOpen).toHaveBeenLastCalledWith("everyone");
  });

  test("while it's open: selected, no sheet options, but + New sheet and the tools", () => {
    tabs(true, true);
    expect(screen.getByRole("tab", { name: "★ Everyone" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Cruz family" }).getAttribute("aria-selected")).toBe("false");
    expect((screen.getByRole("combobox", { name: "Sheet" }) as HTMLSelectElement).value).toBe("everyone");
    expect(screen.queryByRole("button", { name: "Sheet options" })).toBeNull();
    expect(items(openMenu())).toEqual(["+ New sheet", "Picture (PNG)"]);
  });

  test("a Viewer in the List, with nothing to export, gets no empty sheet menu", () => {
    tabs(false, true, false);
    expect(screen.queryByRole("button", { name: "Sheet menu" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hide photos" })).toBeDefined(); // the eye stays
  });
});
