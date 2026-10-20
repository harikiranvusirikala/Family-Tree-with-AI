// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { everyoneView } from "../everyone";
import { buildSheetView } from "../sheet-view";
import { computeGenerations } from "../generations";
import type { FamilyData, SheetView } from "../types";
import { CARD_HEIGHT, CARD_WIDTH, HEART_GAP, layoutEngine as engine, type LayoutResult } from ".";
import { cruzYoung, wholeSampleSheet } from "@test/fixtures/cruz-young";
import { generateFamily } from "@test/fixtures/generated";

function overlaps(result: LayoutResult): string[] {
  const found: string[] = [];
  const ps = result.persons;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (a.x < b.x + CARD_WIDTH && b.x < a.x + CARD_WIDTH && a.y < b.y + CARD_HEIGHT && b.y < a.y + CARD_HEIGHT) {
        found.push(`${a.id} / ${b.id}`);
      }
    }
  }
  return found;
}

const at = (result: LayoutResult, id: string) => {
  const p = result.persons.find((x) => x.id === id);
  if (!p) throw new Error(`${id} was not placed`);
  return p;
};

/** Both partners on one row, one heart gap apart, with the heart between them. */
function expectPartnersBesideUnion(result: LayoutResult, view: SheetView, unionId: string) {
  const union = view.unions.find((u) => u.id === unionId)!;
  const [a, b] = union.partnerIds.map((id) => at(result, id));
  const [left, right] = a.x < b.x ? [a, b] : [b, a];
  const heart = result.unions.find((u) => u.id === unionId)!;
  expect(left.y, `${unionId}: partners on one row`).toBe(right.y);
  expect(right.x - left.x, `${unionId}: partners side by side`).toBeCloseTo(CARD_WIDTH + HEART_GAP, 0);
  expect(heart.x).toBeGreaterThan(left.x + CARD_WIDTH);
  expect(heart.x).toBeLessThan(right.x);
}

const view = buildSheetView(cruzYoung, wholeSampleSheet);

describe(`layout engine: ${engine.name}`, () => {
  let result: LayoutResult;
  beforeAll(async () => {
    result = await engine.layout(view);
  });

  test("places all 36 people from the sample", () => {
    expect(result.persons.map((p) => p.id).sort()).toEqual(view.persons.map((p) => p.id).sort());
  });

  test("no cards overlap", () => {
    expect(overlaps(result)).toEqual([]);
  });

  test("★ Everyone: unconnected families and someone on their own are laid out side by side (owner request)", async () => {
    // The sample plus a couple with a child, joined to nobody, and one person on their own.
    const view = everyoneView({
      persons: [
        ...cruzYoung.persons,
        { id: "ravi-rao", name: "Ravi Rao", gender: "male" },
        { id: "priya-rao", name: "Priya Rao", gender: "female" },
        { id: "anu-rao", name: "Anu Rao", gender: "female" },
        { id: "zoe-avila", name: "Zoë Ávila", gender: "female" },
      ],
      unions: [...cruzYoung.unions, { id: "u-rao", partnerIds: ["ravi-rao", "priya-rao"], status: "married", childIds: ["anu-rao"] }],
      sheets: [],
    });
    const r = await engine.layout(view);
    expect(r.persons).toHaveLength(40);
    expect(overlaps(r)).toEqual([]);
    expectPartnersBesideUnion(r, view, "u-rao");
    expect(at(r, "anu-rao").y).toBeGreaterThan(at(r, "ravi-rao").y);
  });

  test("each generation sits in one row, older generations above", () => {
    const generations = computeGenerations(view);
    const rowOf = new Map<number, Set<number>>();
    for (const p of result.persons) {
      const g = generations.get(p.id)!;
      rowOf.set(g, new Set([...(rowOf.get(g) ?? []), p.y]));
    }
    const rows = [...rowOf.entries()].sort(([a], [b]) => a - b);
    for (const [g, ys] of rows) expect([...ys], `generation ${g} in one row`).toHaveLength(1);
    const ys = rows.map(([, set]) => [...set][0]);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  test("children are below their parents' union", () => {
    for (const u of view.unions) {
      const parentsBottom = Math.max(...u.partnerIds.map((id) => at(result, id).y)) + CARD_HEIGHT;
      for (const c of u.childIds) expect(at(result, c).y, `${c} below ${u.id}`).toBeGreaterThan(parentsBottom);
    }
  });

  test("every couple sits side by side with its heart between them", () => {
    for (const u of view.unions) expectPartnersBesideUnion(result, view, u.id);
  });

  test("Steve Cruz's divorce and remarriage both work", () => {
    expectPartnersBesideUnion(result, view, "u-sammie-steve");
    expectPartnersBesideUnion(result, view, "u-steve-arham");
  });

  test("the same-sex couple Alexander Cruz + Jerry Willow works", () => {
    expectPartnersBesideUnion(result, view, "u-alexander-jerry");
  });

  test("adding a child lays the tree out again with no overlaps", async () => {
    const data: FamilyData = {
      persons: [...cruzYoung.persons, { id: "new-baby", name: "New Baby", gender: "female", birthYear: 2026 }],
      unions: cruzYoung.unions.map((u) => (u.id === "u-jane-william" ? { ...u, childIds: [...u.childIds, "new-baby"] } : u)),
    };
    const relaid = await engine.layout(buildSheetView(data, wholeSampleSheet));
    expect(overlaps(relaid)).toEqual([]);
    expect(at(relaid, "new-baby").y).toBeGreaterThan(at(relaid, "jane-howell").y);
  });

  test("in the sample, siblings with no family of their own are in birth order", () => {
    for (const run of [
      ["carrie-young", "carlo-young", "tay-young"],
      ["amelia-young", "jake-young", "timothy-young-2010"],
      ["taylor-cruz", "anna-cruz"],
    ]) {
      const xs = run.map((id) => at(result, id).x);
      expect(xs, run.join(", ")).toEqual([...xs].sort((a, b) => a - b));
    }
  });

  test("siblings are ordered by birth year, left to right", async () => {
    const family: FamilyData = {
      persons: [
        { id: "dad", name: "Dad", gender: "male", birthYear: 1950 },
        { id: "mum", name: "Mum", gender: "female", birthYear: 1952 },
        { id: "c3", name: "Youngest", gender: "male", birthYear: 1985 },
        { id: "c1", name: "Eldest", gender: "female", birthYear: 1978 },
        { id: "c2", name: "Middle", gender: "male", birthYear: 1981 },
      ],
      unions: [{ id: "u", partnerIds: ["dad", "mum"], status: "married", childIds: ["c3", "c1", "c2"] }],
    };
    const r = await engine.layout(buildSheetView(family, { rootPersonId: "dad", extraPersonIds: [] }));
    const xs = ["c1", "c2", "c3"].map((id) => at(r, id).x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  // A regression guard, not a benchmark: about 250 ms on a recent laptop, slower on CI runners.
  const limit = process.env.CI ? 1500 : 400;
  test(`a 300-person family lays out in under ${limit} ms`, async () => {
    const big = generateFamily(300);
    const bigView = buildSheetView(big.data, big.sheet);
    await engine.layout(bigView); // warm-up
    const start = performance.now();
    const r = await engine.layout(bigView);
    const elapsed = performance.now() - start;
    expect(r.persons).toHaveLength(300);
    expect(elapsed).toBeLessThan(limit);
  });
});
