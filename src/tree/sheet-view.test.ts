// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildSheetView, showsNewParentsOf } from "./sheet-view";
import type { FamilyData, Sheet, Union } from "./types";
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

describe("buildSheetView: a sheet that leaves out one couple's children (hideChildrenOf)", () => {
  test("Jerry's side only: his parents and his partner, not their children or anyone below them", () => {
    const view = buildSheetView(cruzYoung, { ...jerrySheet, hideChildrenOf: "u-alexander-jerry" });
    expect(ids(view).sort()).toEqual(["alexander-cruz", "cynthia-willow", "fred-lambert", "jerry-willow"]);
    expect(view.unions.find((u) => u.id === "u-alexander-jerry")).toMatchObject({ childIds: [] }); // the heart, no children
  });

  test("only that couple's children: those from another couple stay, and an extra still shows", () => {
    const view = buildSheetView(cruzYoung, { rootPersonId: "steve-cruz", extraPersonIds: ["taylor-cruz"], hideChildrenOf: "u-steve-arham" });
    expect(ids(view)).toEqual(expect.arrayContaining(["william-cruz-2002", "jane-howell", "william-cruz-2021", "alex-cruz", "taylor-cruz"]));
    expect(ids(view)).not.toContain("anna-cruz");
  });
});

describe("buildSheetView: not above someone whose side of the family is on their own sheet (owner request)", () => {
  const marvin: Sheet = { rootPersonId: "marvin-young", extraPersonIds: [] };
  // Emma Young's own sheet, leaving out her children with Timothy Cruz: her side of the family.
  const emmasSide: Sheet = { rootPersonId: "emma-young", extraPersonIds: [], hideChildrenOf: "u-timothy-emma" };

  test("her son's sheet shows her, and his father's side to the top, but not her parents; her own sheet shows them", () => {
    expect(buildSheetView(cruzYoung, marvin).persons).toHaveLength(36); // without her sheet: both sides
    const withHers = { ...cruzYoung, sheets: [marvin, emmasSide] };
    const view = ids(buildSheetView(withHers, marvin));
    expect(view).toEqual(
      expect.arrayContaining(["emma-young", "timothy-cruz-1940", "alexander-cruz", "jerry-willow", "timothy-cruz-1880", "amy-harolds", "cynthia-willow", "fred-lambert"]),
    );
    expect(view).not.toContain("margaret-yap");
    expect(view).not.toContain("nick-young");
    expect(view).toHaveLength(34);
    expect(ids(buildSheetView(withHers, emmasSide)).sort()).toEqual(["emma-young", "margaret-yap", "nick-young", "timothy-cruz-1940"]);
  });

  test("the sheet decides, not gender: Jerry Willow's own side stops his grandson's sheet at him", () => {
    const jerrysSide: Sheet = { ...jerrySheet, hideChildrenOf: "u-alexander-jerry" };
    const view = ids(buildSheetView({ ...cruzYoung, sheets: [jerrysSide] }, marvin));
    expect(view).toEqual(expect.arrayContaining(["jerry-willow", "timothy-cruz-1880", "amy-harolds", "margaret-yap", "nick-young"]));
    expect(view).not.toContain("cynthia-willow");
    expect(view).not.toContain("fred-lambert");
  });

  test("a sheet of theirs that shows all their children doesn't stop it", () => {
    expect(ids(buildSheetView({ ...cruzYoung, sheets: [jerrySheet] }, marvin))).toEqual(expect.arrayContaining(["cynthia-willow", "fred-lambert"]));
  });

  test("someone reached through two couples is still walked above through the one their sheet doesn't leave out", () => {
    // Gran's grandchildren by two husbands, cousins, are Rose's parents.
    const u = (id: string, partnerIds: [string, string], childIds: string[]): Union => ({ id, partnerIds, status: "married", childIds });
    const family: FamilyData = {
      persons: ["ggf", "ggm", "gran", "andy", "bob", "c1", "c2", "x", "y", "d1", "d2", "rose"].map((id) => ({ id, name: id, gender: "female" })),
      unions: [
        u("u-gg", ["ggf", "ggm"], ["gran"]),
        u("u1", ["gran", "andy"], ["c1"]),
        u("u2", ["gran", "bob"], ["c2"]),
        u("u3", ["c1", "x"], ["d1"]),
        u("u4", ["c2", "y"], ["d2"]),
        u("u5", ["d1", "d2"], ["rose"]),
      ],
    };
    const rose: Sheet = { rootPersonId: "rose", extraPersonIds: [] };
    const side = (couple: string): Sheet => ({ rootPersonId: "gran", extraPersonIds: [], hideChildrenOf: couple });
    expect(ids(buildSheetView({ ...family, sheets: [side("u1")] }, rose))).toEqual(expect.arrayContaining(["ggf", "ggm"]));
    expect(ids(buildSheetView({ ...family, sheets: [side("u2")] }, rose))).toEqual(expect.arrayContaining(["ggf", "ggm"]));
    expect(ids(buildSheetView({ ...family, sheets: [side("u1"), side("u2")] }, rose))).not.toContain("ggf");
  });

  test("showsNewParentsOf: whether parents added to someone would be drawn on a sheet", () => {
    const withHers = { ...cruzYoung, sheets: [marvin, emmasSide] };
    expect(showsNewParentsOf(withHers, marvin, "timothy-cruz-1880")).toBe(true); // the top of the father's side
    expect(showsNewParentsOf(withHers, marvin, "margaret-yap")).toBe(false); // above Emma: her sheet's
    expect(showsNewParentsOf(withHers, emmasSide, "margaret-yap")).toBe(true);
    expect(showsNewParentsOf(cruzYoung, cruzSheet, "taylor-humes")).toBe(false); // she married in (step 3)
    expect(showsNewParentsOf(cruzYoung, { rootPersonId: "taylor-humes", extraPersonIds: [] }, "taylor-humes")).toBe(true);
    // The other parent, joining a single parent's couple.
    const fatherOnly: FamilyData = { ...cruzYoung, unions: cruzYoung.unions.map((u) => (u.id === "u-timothy-amy" ? { ...u, partnerIds: ["timothy-cruz-1880"] } : u)) };
    expect(showsNewParentsOf(fatherOnly, cruzSheet, "alexander-cruz")).toBe(true);
    expect(showsNewParentsOf(fatherOnly, jerrySheet, "alexander-cruz")).toBe(false); // Jerry's partner: his parents aren't followed
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
