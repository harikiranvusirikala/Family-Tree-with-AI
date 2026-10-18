// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildSheetView } from "./sheet-view";
import type { FamilyData } from "./types";
import { cruzSheet, cruzYoung, inLawParentIds, jerrySheet, wholeSampleSheet } from "@test/fixtures/cruz-young";

const ids = (view: { persons: { id: string }[] }) => view.persons.map((p) => p.id);

describe("buildSheetView: ARCHITECTURE.md §6 worked examples", () => {
  test("Cruz sheet: ancestors, all their descendants and those people's partners", () => {
    const view = buildSheetView(cruzYoung, cruzSheet);
    expect(ids(view)).toEqual(
      expect.arrayContaining([
        "timothy-cruz-1880", "amy-harolds", // ancestors
        "jake-cruz", "olivia-cruz", "timothy-cruz-1940", "william-cruz-2021", // descendants
        "jerry-willow", "taylor-humes", "arjun-patel", "emma-young", // partners
        "sammie-chang", "arham-chopra", // ex-partner and current partner
      ]),
    );
  });

  test("Cruz sheet leaves out in-law parents; partners' parents are not followed", () => {
    const view = buildSheetView(cruzYoung, cruzSheet);
    for (const id of inLawParentIds) expect(ids(view)).not.toContain(id);
    expect(view.persons).toHaveLength(32);
  });

  test("Jerry Willow's sheet shows his parents and the same descendant records", () => {
    const view = buildSheetView(cruzYoung, jerrySheet);
    expect(ids(view)).toEqual(
      expect.arrayContaining(["cynthia-willow", "fred-lambert", "jake-cruz", "olivia-cruz", "timothy-cruz-1940"]),
    );
    expect(ids(view)).not.toContain("timothy-cruz-1880");
    expect(ids(view)).not.toContain("amy-harolds");
  });

  test("Cruz sheet plus the 4 in-law parents as extras shows all 36 people", () => {
    const view = buildSheetView(cruzYoung, wholeSampleSheet);
    expect(view.persons).toHaveLength(36);
    expect(view.unions).toHaveLength(12);
  });
});

describe("buildSheetView: unions on a sheet", () => {
  test("a union is shown only when all its partners are on the sheet", () => {
    const view = buildSheetView(cruzYoung, cruzSheet);
    const unionIds = view.unions.map((u) => u.id);
    expect(unionIds).not.toContain("u-cynthia-fred"); // Jerry's parents are not on the Cruz sheet
    expect(unionIds).toContain("u-alexander-jerry");
  });

  test("a child added once appears on every sheet that reaches them", () => {
    const withBaby: FamilyData = {
      persons: [...cruzYoung.persons, { id: "baby", name: "Baby Cruz", gender: "female", birthYear: 2026 }],
      unions: cruzYoung.unions.map((u) =>
        u.id === "u-jane-william" ? { ...u, childIds: [...u.childIds, "baby"] } : u,
      ),
    };
    expect(ids(buildSheetView(withBaby, cruzSheet))).toContain("baby");
    expect(ids(buildSheetView(withBaby, jerrySheet))).toContain("baby");
  });

  test("unknown root gives an empty view; unknown extras are ignored", () => {
    expect(buildSheetView(cruzYoung, { rootPersonId: "nobody", extraPersonIds: [] }).persons).toEqual([]);
    const view = buildSheetView(cruzYoung, { ...cruzSheet, extraPersonIds: ["nobody"] });
    expect(view.persons).toHaveLength(32);
  });
});
