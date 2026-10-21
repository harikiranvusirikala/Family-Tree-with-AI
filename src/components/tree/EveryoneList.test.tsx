import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { sampleState, toGroupTree } from "@test/planning";
import { listRows, type ListFilter, type ListSort } from "@/tree/everyone";
import { ExportItems } from "../import-export/ExportMenu";
import { EveryoneList } from "./EveryoneList";

afterEach(cleanup);

// jsdom applies no CSS, so every column, and the phone's line under each name, are in the page here.
const tree = toGroupTree(sampleState());
const rows = listRows(tree);
const idOf = (name: string) => tree.persons.find((p) => p.name === name)!.id;

function list({ filter = "everyone", query = "", sort = "name", selectedId }: { filter?: ListFilter; query?: string; sort?: ListSort; selectedId?: string } = {}) {
  const calls = { onFilter: vi.fn(), onSort: vi.fn(), onShowAll: vi.fn(), onPerson: vi.fn(), onOpenSheet: vi.fn() };
  render(<EveryoneList rows={rows} filter={filter} query={query} sort={sort} selectedId={selectedId} {...calls} />);
  return calls;
}
const table = () => screen.getByRole("table", { name: "People" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1); // after the column names
const rowOf = (name: string) => bodyRows().find((r) => within(r).queryByRole("button", { name: new RegExp(`^${name}\\b`) }))!;

describe("★ Everyone's List (owner request)", () => {
  test("everyone A to Z, with parents, partners, children and the sheets that show them", () => {
    list();
    expect(within(table()).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Person", "Born↕", "Parents", "Partners", "Children", "On sheets"]);
    expect(bodyRows()).toHaveLength(36);
    const steve = within(rowOf("Steve Cruz")).getAllByRole("cell").map((c) => c.textContent);
    expect(steve).toEqual([
      "SCSteve Cruz19851985Child of Olivia & Arjun · ♥ Sammie, Arham · 3 children", // the years wide, the dates narrow
      "1985",
      "Olivia Cruz, Arjun Patel",
      "Sammie Chang (divorced), Arham Chopra",
      "3 · William Cruz, Anna Cruz, Taylor Cruz",
      "Cruz familyJerry Willow's family",
    ]);
    expect(within(rowOf("Amy Harolds")).getAllByRole("cell")[1].textContent).toBe("1885Died 1966");
    expect(within(rowOf("Amy Harolds")).getAllByRole("cell")[2].textContent).toBe("–");
  });

  test("the name is a button named like the person's card; a row chooses the person, a sheet opens that sheet", () => {
    const { onPerson, onOpenSheet } = list();
    fireEvent.click(screen.getByRole("button", { name: "Steve Cruz, 1985" }));
    expect(onPerson).toHaveBeenLastCalledWith(idOf("Steve Cruz"));
    fireEvent.click(within(rowOf("Amy Harolds")).getAllByRole("cell")[2]);
    expect(onPerson).toHaveBeenLastCalledWith(idOf("Amy Harolds"));
    onPerson.mockClear();
    fireEvent.click(within(rowOf("Steve Cruz")).getByRole("button", { name: "Jerry Willow's family" }));
    expect(onOpenSheet).toHaveBeenCalledWith(tree.sheets.find((s) => s.title === "Jerry Willow's family")!.id, idOf("Steve Cruz"));
    expect(onPerson).not.toHaveBeenCalled();
  });

  test("filters with their counts; the chosen filter and what was typed narrow the rows", () => {
    const { onFilter } = list({ filter: "marriedIn" });
    const filters = screen.getByRole("group", { name: "Show" });
    expect(within(filters).getAllByRole("button").map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["Everyone (36)", "false"],
      ["Living (25)", "false"],
      ["Married in (7)", "true"],
      ["On no sheet (0)", "false"],
    ]);
    expect(bodyRows()).toHaveLength(7);
    fireEvent.click(within(filters).getByRole("button", { name: "Living (25)" }));
    expect(onFilter).toHaveBeenCalledWith("living");
    cleanup();
    list({ filter: "living", query: "timothy" });
    expect(bodyRows().map((r) => within(r).getAllByRole("button")[0].getAttribute("aria-label"))).toEqual(["Timothy Young, 1970", "Timothy Young, 2010"]);
  });

  test("nobody matching: says so, and shows everyone again", () => {
    const { onShowAll } = list({ query: "nobody here" });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Nobody matches.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Show everyone" }));
    expect(onShowAll).toHaveBeenCalled();
  });

  test("the selected person's row is marked and scrolled into view", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled; // jsdom has none
    try {
      list({ selectedId: idOf("Steve Cruz") });
      expect(rowOf("Steve Cruz").getAttribute("aria-current")).toBe("true");
      expect(rowOf("Anna Cruz").getAttribute("aria-current")).toBeNull();
      expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
      expect(scrolled.mock.contexts[0]).toBe(rowOf("Steve Cruz"));
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe("Born, with full dates, and sorting by it (owner request)", () => {
  // Steve Cruz with his full birth date; Taylor Cruz with no birth year.
  const dated = rows.map((r) =>
    r.person.name === "Steve Cruz" ? { ...r, person: { ...r.person, birthMonth: 3, birthDay: 12 } } : r.person.name === "Taylor Cruz" ? { ...r, person: { ...r.person, birthYear: undefined } } : r,
  );
  const order = () => bodyRows().map((r) => within(r).getAllByRole("button")[0].getAttribute("aria-label"));

  function sorted(sort: ListSort) {
    const calls = { onFilter: vi.fn(), onSort: vi.fn(), onShowAll: vi.fn(), onPerson: vi.fn(), onOpenSheet: vi.fn() };
    render(<EveryoneList rows={dated} filter="everyone" query="" sort={sort} {...calls} />);
    return calls;
  }

  test("the Born column holds the full date where known, and the death's", () => {
    sorted("name");
    expect(within(rowOf("Steve Cruz")).getAllByRole("cell")[1].textContent).toBe("12 Mar 1985");
    expect(within(rowOf("Jake Cruz")).getAllByRole("cell")[1].textContent).toBe("1945Died 2022");
    expect(within(rowOf("Taylor Cruz")).getAllByRole("cell")[1].textContent).toBe("–");
    expect(within(rowOf("Steve Cruz")).getAllByRole("cell")[0].textContent).toContain("12 Mar 1985"); // narrow screens
  });

  test("A to Z by default; oldest first and youngest first by birth, nobody without a year until the end", () => {
    sorted("name");
    expect(order().slice(0, 2)).toEqual(["Alex Cruz, 2021", "Alexander Cruz, 1918 – 2003"]);
    cleanup();
    sorted("oldest");
    expect(order().slice(0, 2)).toEqual(["Timothy Cruz, 1880 – 1962", "Amy Harolds, 1885 – 1966"]);
    expect(order().at(-1)).toBe("Taylor Cruz");
    cleanup();
    sorted("youngest");
    expect(order()[0]).toBe("Alex Cruz, 2021");
    expect(order().at(-1)).toBe("Taylor Cruz");
    expect(within(table()).getAllByRole("columnheader")[1].getAttribute("aria-sort")).toBe("descending");
  });

  test("the Born column's name goes round the orders; the Sort choice picks one", () => {
    const { onSort } = sorted("name");
    fireEvent.click(within(table()).getByRole("button", { name: /^Born/ }));
    expect(onSort).toHaveBeenLastCalledWith("oldest");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "youngest" } });
    expect(onSort).toHaveBeenLastCalledWith("youngest");
    expect([...(screen.getByRole("combobox", { name: "Sort" }) as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["A to Z", "Oldest first", "Youngest first"]);
  });
});

describe("Export in ★ Everyone's List (owner request)", () => {
  const items = () => screen.getAllByRole("menuitem").map((i) => i.textContent);

  test("without a picture: only the whole group's data, under its heading", () => {
    render(<ExportItems groupId="g" canExportData itemClass="" />);
    expect(items()).toEqual(["Data: whole group (GEDCOM)", "Data: whole group (JSON)"]);
    expect(screen.queryByText("Everyone")).toBeNull();
    expect(screen.getByText("The whole group")).toBeDefined();
  });

  test("with a picture, as on the Tree", () => {
    render(<ExportItems groupId="g" canExportData itemClass="" onPicture={() => {}} onPrint={() => {}} />);
    expect(items()).toEqual(["Picture (PNG)", "Print or save as PDF", "Data: whole group (GEDCOM)", "Data: whole group (JSON)"]);
    expect(screen.getByText("Everyone")).toBeDefined();
  });
});
