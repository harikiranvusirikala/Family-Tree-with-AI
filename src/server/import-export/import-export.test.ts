// @vitest-environment node
import { ObjectId } from "mongodb";
import { describe, expect, test } from "vitest";
import { operationsSchema } from "@/server/operations/schema";
import { buildSheetView } from "@/tree/sheet-view";
import type { GroupTree } from "@/tree/types";
import { applyPlan, emptyGroup, sampleState, toGroupTree } from "@test/planning";
import { dateOf, exportGedcom, parseGedcom, yearOf } from "./gedcom";
import { defaultUseExisting, findDuplicates, importOperations, type ImportChoices } from "./import-plan";
import { exportJson, parseJson } from "./json";
import { exportPart, fileName, MAX_IMPORT_PEOPLE, type ImportData } from "./types";

const state = sampleState(); // one sample group: every sampleState() call has new ids
const tree = toGroupTree(state);
const empty: GroupTree = { persons: [], unions: [], sheets: [] };
const group = { id: "a".repeat(24), name: "Cruz family" };
const fresh: ImportChoices = { genders: {}, useExisting: {}, intoExistingGroup: false };

/** Imports parsed data into an empty group with the real planner; what the browser would then draw. */
function importIntoEmpty(data: ImportData | string, choices: ImportChoices = fresh) {
  if (typeof data === "string") throw new Error(data);
  const batch = importOperations(data, choices, empty);
  if (typeof batch === "string") throw new Error(batch);
  expect(operationsSchema.safeParse(batch.operations).success).toBe(true);
  return toGroupTree(applyPlan(emptyGroup, batch.operations));
}

/** People and couples by name, comparable across ids. */
function shape(t: GroupTree) {
  const name = new Map(t.persons.map((p) => [p.id, `${p.name} ${p.birthYear ?? ""}`]));
  return {
    persons: t.persons.map((p) => `${p.name}|${p.gender}|${p.birthYear ?? ""}|${p.deathYear ?? ""}`).sort(),
    unions: t.unions.map((u) => `${u.partnerIds.map((id) => name.get(id)).sort().join(" & ")} ${u.status}: ${u.childIds.map((id) => name.get(id)).sort().join(", ")}`).sort(),
  };
}

describe("round trips of the sample family", () => {
  test("JSON gives back the same people, couples and sheets", () => {
    const back = importIntoEmpty(parseJson(exportJson(tree, group)));
    expect(shape(back)).toEqual(shape(tree));
    expect(back.sheets.map((s) => [s.title, s.pinned, s.extraPersonIds.length]).sort()).toEqual(tree.sheets.map((s) => [s.title, s.pinned, s.extraPersonIds.length]).sort());
    for (const sheet of back.sheets) {
      const original = tree.sheets.find((s) => s.title === sheet.title)!;
      expect(buildSheetView(back, sheet).persons).toHaveLength(buildSheetView(tree, original).persons.length);
    }
  });

  test("JSON keeps a sheet that leaves out a couple's children, from the whole group or that sheet alone", () => {
    const jerry = tree.persons.find((p) => p.name === "Jerry Willow")!.id;
    const couple = tree.unions.find((u) => u.partnerIds.includes(jerry))!;
    const withSide = toGroupTree(
      applyPlan(state, [{ op: "createSheet", title: "Jerry's side", rootPersonId: jerry, hideChildrenOf: couple.id }]),
    );
    const side = withSide.sheets.find((s) => s.title === "Jerry's side")!;
    for (const file of [exportJson(withSide, group), exportJson(withSide, group, side)]) {
      const back = importIntoEmpty(parseJson(file));
      const sheet = back.sheets.find((s) => s.title === "Jerry's side")!;
      const names = (ids: string[]) => ids.map((id) => back.persons.find((p) => p.id === id)!.name).sort();
      expect(names(back.unions.find((u) => u.id === sheet.hideChildrenOf)!.partnerIds)).toEqual(["Alexander Cruz", "Jerry Willow"]);
      expect(names(buildSheetView(back, sheet).persons.map((p) => p.id))).toEqual(["Alexander Cruz", "Cynthia Willow", "Fred Lambert", "Jerry Willow"]);
    }
  });

  test("GEDCOM gives back the same people and couples, and a sheet for the first person", () => {
    const text = exportGedcom(tree);
    expect(text.startsWith("0 HEAD\n")).toBe(true);
    expect(text).toContain("1 CHAR UTF-8");
    expect(text).toContain("1 NAME Jake /Cruz/");
    expect(text.trimEnd().endsWith("0 TRLR")).toBe(true);
    const data = parseGedcom(text, "cruz.ged");
    expect(data).toMatchObject({ kind: "gedcom", warnings: [], notKept: [], suggestedName: "cruz" });
    const back = importIntoEmpty(data);
    expect(shape(back)).toEqual(shape(tree));
    expect(back.sheets.map((s) => s.title)).toEqual([`${tree.persons[0].name}'s family`]);
  });

  test("a same-sex couple survives GEDCOM (two HUSB lines)", () => {
    const alexander = tree.persons.find((p) => p.name === "Alexander Cruz")!;
    const jerry = tree.persons.find((p) => p.name === "Jerry Willow")!;
    expect([alexander.gender, jerry.gender]).toEqual(["male", "male"]);
    const text = exportGedcom(tree);
    const fam = text.split("0 @F").find((f) => f.includes(`HUSB @I${tree.persons.indexOf(alexander) + 1}@`))!;
    expect(fam.match(/^1 HUSB /gm)).toHaveLength(2);
    const back = importIntoEmpty(parseGedcom(text));
    expect(shape(back).unions).toContain(shape(tree).unions.find((u) => u.startsWith("Alexander Cruz 1918 & Jerry Willow")));
  });
});

describe("exporting one sheet", () => {
  test("exactly the people and couples the sheet shows (§6)", () => {
    const jerry = tree.sheets.find((s) => s.title === "Jerry Willow's family")!;
    const view = buildSheetView(tree, jerry);
    expect(exportPart(tree, jerry).persons.map((p) => p.id).sort()).toEqual(view.persons.map((p) => p.id).sort());
    const json = JSON.parse(exportJson(tree, group, jerry));
    expect(json.persons).toHaveLength(32);
    expect(json.sheets).toHaveLength(1);
    expect(exportGedcom(tree, jerry).match(/ INDI$/gm)).toHaveLength(32);
    expect(exportGedcom(tree, jerry).match(/ FAM$/gm)).toHaveLength(view.unions.length);
  });

  test("file names lose characters file systems refuse", () => {
    expect(fileName("Cruz/Young: family", "Jerry's \"sheet\"")).toBe("Cruz_Young_ family - Jerry's _sheet_");
  });
});

describe("reading GEDCOM files from other programs", () => {
  const head = "0 HEAD\r\n1 GEDC\r\n2 VERS 5.5.1\r\n1 CHAR UTF-8\r\n";
  const parse = (body: string) => parseGedcom(`﻿${head}${body}0 TRLR\r\n`) as ImportData;

  test("names, sex and years, with a BOM, CRLF line endings and long values split over lines", () => {
    const data = parse(
      "0 @I1@ INDI\r\n1 NAME Ravi /Kumar/\r\n1 SEX M\r\n1 BIRT\r\n2 DATE 12 MAR 1980\r\n2 PLAC Pune, India\r\n" +
        "0 @I2@ INDI\r\n1 NAME\r\n2 GIVN Anaïs\r\n2 SURN Dubois\r\n1 SEX F\r\n1 BIRT\r\n2 DATE ABT 1902\r\n1 DEAT\r\n2 DATE BET 1970 AND 1975\r\n1 NOTE A long\r\n2 CONC  note\r\n" +
        "0 @I3@ INDI\r\n1 NAME Bartholomew Alexander /Fitz\r\n2 CONC william/\r\n1 SEX U\r\n1 BIRT\r\n2 DATE 0985\r\n1 OCCU Farmer\r\n",
    );
    expect(data.persons).toEqual([
      { id: "@I1@", name: "Ravi Kumar", gender: "male", birthYear: 1980, birthMonth: 3, birthDay: 12 }, // an exact date is kept whole
      { id: "@I2@", name: "Anaïs Dubois", gender: "female", birthYear: 1902, deathYear: 1970 },
      { id: "@I3@", name: "Bartholomew Alexander Fitzwilliam", gender: null },
    ]);
    expect(data.notKept).toEqual(["places", "dates that aren't exact (only their years are kept)", "notes", "other facts (such as occupations, burials and residences)"]); // always in this order
  });

  test("dates", () => {
    expect([yearOf("12 MAR 1985"), yearOf("ABT 1900"), yearOf("BET 1900 AND 1910"), yearOf("1985"), yearOf("JUN 0099"), yearOf("2500"), yearOf(undefined)]).toEqual([1985, 1900, 1900, 1985, undefined, undefined, undefined]);
  });

  test("full dates (owner request): exact dates kept whole, others as a year; impossible days as a year", () => {
    expect([dateOf("12 MAR 1985"), dateOf("02 feb 2000"), dateOf("MAR 1985"), dateOf("ABT 12 MAR 1985"), dateOf("30 FEB 1985"), dateOf(undefined)]).toEqual([
      { year: 1985, month: 3, day: 12 },
      { year: 2000, month: 2, day: 2 },
      { year: 1985 },
      { year: 1985 },
      { year: 1985 },
      {},
    ]);
  });

  test("JSON keeps full dates (owner request), and refuses a file whose dates don't make sense", () => {
    const asha = { id: "a".repeat(24), name: "Asha Rao", gender: "female" as const, birthYear: 1940, birthMonth: 2, birthDay: 29, deathYear: 2020, deathMonth: 12, deathDay: 1 };
    const file = exportJson({ persons: [asha], unions: [], sheets: [] }, { id: "g", name: "Raos" });
    expect((parseJson(file) as ImportData).persons[0]).toMatchObject({ birthYear: 1940, birthMonth: 2, birthDay: 29, deathYear: 2020, deathMonth: 12, deathDay: 1 });
    expect(parseJson(file.replace('"birthDay": 29', '"birthDay": 30'))).toBe("This file is damaged: Asha Rao's dates don't make sense.");
  });

  test("full dates go out as 12 MAR 1985 and come back the same, for birth and death", () => {
    const tree: GroupTree = {
      persons: [{ id: "a".repeat(24), name: "Asha Rao", gender: "female", birthYear: 1940, birthMonth: 2, birthDay: 29, deathYear: 2020, deathMonth: 12, deathDay: 1 }],
      unions: [],
      sheets: [],
    };
    const file = exportGedcom(tree);
    expect(file).toContain("1 BIRT\n2 DATE 29 FEB 1940");
    expect(file).toContain("1 DEAT\n2 DATE 1 DEC 2020");
    const back = parseGedcom(file) as ImportData;
    expect(back.persons[0]).toMatchObject({ birthYear: 1940, birthMonth: 2, birthDay: 29, deathYear: 2020, deathMonth: 12, deathDay: 1 });
    expect(back.notKept).toEqual([]);
  });

  test("families: divorce, a family with no partners, a child in two families, the same couple twice", () => {
    // C was adopted into F9 (not in the file) and born into F1; F3 also lists C, so C stays with F1.
    const famc = (i: number) => (i === 2 ? "1 FAMC @F9@\n2 PEDI adopted\n1 FAMC @F1@\n2 PEDI birth\n" : "");
    const people = ["A", "B", "C", "D", "E"].map((x, i) => `0 @I${i + 1}@ INDI\n1 NAME ${x} /Test/\n1 SEX ${i % 2 ? "F" : "M"}\n${famc(i)}`).join("");
    const data = parse(
      people +
        "0 @F1@ FAM\n1 HUSB @I1@\n1 WIFE @I2@\n1 CHIL @I3@\n1 DIV Y\n" +
        "0 @F2@ FAM\n1 CHIL @I4@\n" +
        "0 @F3@ FAM\n1 HUSB @I5@\n1 WIFE @I2@\n1 CHIL @I3@\n" +
        "0 @F4@ FAM\n1 WIFE @I2@\n1 HUSB @I1@\n1 CHIL @I4@\n",
    );
    expect(data.unions).toEqual([
      { id: "@F1@", partnerIds: ["@I1@", "@I2@"], status: "divorced", childIds: ["@I3@", "@I4@"] },
      { id: "@F3@", partnerIds: ["@I5@", "@I2@"], status: "married", childIds: [] },
    ]);
    expect(data.warnings).toEqual([
      "1 family without parents was skipped; their children are imported without parents.",
      "1 child is listed in two families; each stays with the first (or the birth family, where the file says).",
      "1 couple was listed twice and was joined.",
    ]);
  });

  test("files that can't be imported", () => {
    expect(parseGedcom("hello")).toBe("This isn't a GEDCOM file with people in it.");
    const many = Array.from({ length: MAX_IMPORT_PEOPLE + 1 }, (_, i) => `0 @I${i}@ INDI\n1 NAME P${i}\n`).join("");
    expect(parseGedcom(`0 HEAD\n${many}0 TRLR\n`)).toMatch(/has 2001 people; the limit is 2000/);
    expect(parseGedcom("0 HEAD\n1 CHAR ANSEL\n0 @I1@ INDI\n1 NAME X\n")).toMatchObject({ warnings: [expect.stringContaining("ANSEL character set")] });
  });
});

describe("importing into a group with people already in it", () => {
  const jake = tree.persons.find((p) => p.name === "Jake Cruz")!;
  const taylor = tree.persons.find((p) => p.name === "Taylor Humes")!;
  const file = parseGedcom(
    "0 HEAD\n" +
      "0 @J@ INDI\n1 NAME Jake /Cruz/\n1 SEX M\n1 BIRT\n2 DATE 1945\n" +
      "0 @T@ INDI\n1 NAME Taylor /Humes/\n1 SEX F\n1 BIRT\n2 DATE 1955\n" +
      "0 @M@ INDI\n1 NAME Mia /Cruz/\n1 BIRT\n2 DATE 1992\n" +
      "0 @F@ FAM\n1 HUSB @J@\n1 WIFE @T@\n1 CHIL @M@\n0 TRLR\n",
  ) as ImportData;

  test("possible duplicates: the same name and birth year, each starting as Use existing", () => {
    const duplicates = findDuplicates(file, tree);
    expect(duplicates.map((d) => [d.imported.name, d.existing.map((p) => p.id)])).toEqual([
      ["Jake Cruz", [jake.id]],
      ["Taylor Humes", [taylor.id]],
    ]);
    expect(defaultUseExisting(duplicates)).toEqual({ "@J@": jake.id, "@T@": taylor.id });
  });

  test("a person with no recorded sex must be chosen first", () => {
    expect(importOperations(file, { ...fresh, intoExistingGroup: true }, tree)).toBe("Choose male or female for Mia Cruz.");
  });

  test("Use existing links to the group's people, and their couple is reused", () => {
    const batch = importOperations(file, { genders: { "@M@": "female" }, useExisting: { "@J@": jake.id, "@T@": taylor.id }, intoExistingGroup: true }, tree);
    if (typeof batch === "string") throw new Error(batch);
    expect(batch.operations.map((op) => op.op)).toEqual(["createPerson", "addChild", "createSheet"]);
    const after = toGroupTree(applyPlan(state, batch.operations));
    const mia = after.persons.find((p) => p.name === "Mia Cruz")!;
    const parents = after.unions.find((u) => u.childIds.includes(mia.id))!.partnerIds;
    expect(parents.sort()).toEqual([jake.id, taylor.id].sort());
    expect(after.sheets.at(-1)).toMatchObject({ title: "Jake Cruz's family", pinned: false });
  });

  test("Keep both adds them as new people", () => {
    const batch = importOperations(file, { genders: { "@M@": "female" }, useExisting: {}, intoExistingGroup: true }, tree);
    if (typeof batch === "string") throw new Error(batch);
    expect(toGroupTree(applyPlan(state, batch.operations)).persons.filter((p) => p.name === "Jake Cruz")).toHaveLength(2);
  });
});

describe("JSON files", () => {
  test("only this app's format, undamaged", () => {
    expect(parseJson("{")).toBe("This isn't a JSON file.");
    expect(parseJson(JSON.stringify({ people: [] }))).toMatch(/wasn't exported from Family Tree with AI/);
    const damaged = JSON.parse(exportJson(tree, group));
    damaged.unions[0].childIds.push("someone-else");
    expect(parseJson(JSON.stringify(damaged))).toBe("This file is damaged: it refers to people it doesn't contain.");
    const badSheet = JSON.parse(exportJson(tree, group));
    badSheet.sheets[0].hideChildrenOf = "no-such-couple";
    expect(parseJson(JSON.stringify(badSheet))).toBe("This file is damaged: it refers to couples it doesn't contain.");
  });

  test("photos are kept only when the file goes back into its own group", () => {
    const withPhoto = toGroupTree({ ...state, persons: state.persons.map((p, i) => (i === 0 ? { ...p, photoId: `groups/${group.id}/abcdefghijklm` } : p)) });
    const data = parseJson(exportJson(withPhoto, group)) as ImportData;
    const photos = (targetGroupId: string) => {
      const batch = importOperations(data, { ...fresh, targetGroupId }, empty);
      return typeof batch === "string" ? [] : batch.operations.filter((op) => op.op === "setPhoto");
    };
    expect(photos(group.id)).toHaveLength(1);
    expect(photos(new ObjectId().toHexString())).toHaveLength(0);
  });

  test("a batch may add at most 2,000 people", () => {
    const people = Array.from({ length: 2001 }, (_, i) => ({ op: "createPerson" as const, tempId: `new:${i}`, name: `P${i}`, gender: "male" as const }));
    expect(operationsSchema.safeParse(people).success).toBe(false);
    expect(operationsSchema.safeParse(people.slice(0, 2000)).success).toBe(true);
  });
});
