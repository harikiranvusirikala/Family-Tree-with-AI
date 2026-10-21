// @vitest-environment node
import { describe, expect, test } from "vitest";
import { sampleState, toGroupTree } from "@test/planning";
import { generateFamily } from "@test/fixtures/generated";
import { kinship } from "./kinship";
import { layoutWheel, WHEEL_LABEL_HEIGHT, WHEEL_LABEL_WIDTH, type WheelLayout } from "./wheel";

const tree = toGroupTree(sampleState());
const idOf = (name: string, year?: number) => tree.persons.find((p) => p.name === name && (year === undefined || p.birthYear === year))!.id;
const steve = kinship(tree, idOf("Steve Cruz"));
const wheel = layoutWheel(steve);
const at = (name: string, year?: number) => wheel.places.get(idOf(name, year))!;

/** People whose circle, name or relation overlaps another's. */
function overlaps(layout: WheelLayout): number {
  const boxes = [...layout.places.values()].map((p) => {
    const width = Math.max(p.size, WHEEL_LABEL_WIDTH);
    return { x: p.x - width / 2, y: p.y - p.size / 2, width, height: p.size + WHEEL_LABEL_HEIGHT };
  });
  let found = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) found++;
    }
  }
  return found;
}

describe("★ Everyone's Wheel (owner request)", () => {
  test("Steve Cruz in the middle, everyone else on the ring of their steps, rings growing outwards", () => {
    expect(wheel.places.size).toBe(36);
    expect(at("Steve Cruz")).toMatchObject({ x: 0, y: 0, ring: 0 });
    expect(wheel.rings).toHaveLength(4);
    expect(wheel.rings).toEqual([...wheel.rings].sort((a, b) => a - b));
    for (const r of steve.relatives) {
      const place = wheel.places.get(r.person.id)!;
      expect(place.ring).toBe(r.path.length);
      expect(Math.hypot(place.x, place.y)).toBeCloseTo(wheel.rings[place.ring - 1], 6);
    }
  });

  test("nobody overlaps", () => {
    expect(overlaps(wheel)).toBe(0);
  });

  test("ancestors up, wives right, children down, uncles and cousins left", () => {
    for (const name of ["Olivia Cruz", "Arjun Patel", "Alexander Cruz", "Amy Harolds"]) expect(at(name).y, name).toBeLessThan(0);
    for (const name of ["Arham Chopra", "Sammie Chang"]) expect(at(name).x, name).toBeGreaterThan(0);
    for (const name of ["William Cruz", "Anna Cruz", "Jane Howell"]) expect(at(name, name === "William Cruz" ? 2002 : undefined).y, name).toBeGreaterThan(0);
    for (const name of ["Jake Cruz", "Christina Cruz", "Maria Young"]) expect(at(name).x, name).toBeLessThan(0);
  });

  test("a family stays together: Jake Cruz's children are nearer him than his brother's are", () => {
    const angle = (p: { x: number; y: number }) => Math.atan2(p.y, p.x);
    const jake = angle(at("Jake Cruz"));
    const apart = (names: string[]) => names.reduce((sum, n) => sum + Math.abs(angle(at(n)) - jake), 0) / names.length;
    expect(apart(["Christina Cruz", "Cullen Cruz", "Marie Cruz"])).toBeLessThan(apart(["Maria Young", "Marvin Young"]));
  });

  test("someone with nobody related is alone in the middle", () => {
    const zoe = { id: "z".repeat(24), name: "Zoë Ávila", gender: "female" as const };
    const alone = layoutWheel(kinship({ ...tree, persons: [...tree.persons, zoe] }, zoe.id));
    expect([...alone.places.keys()]).toEqual([zoe.id]);
    expect(alone.rings).toEqual([]);
  });

  test("2,000 people: related, placed and clear of each other quickly", () => {
    const big = generateFamily(2000).data;
    const start = performance.now();
    const k = kinship({ ...big, sheets: [] }, big.persons[0].id);
    const layout = layoutWheel(k);
    expect(performance.now() - start).toBeLessThan(process.env.CI ? 2000 : 600);
    expect(layout.places.size).toBe(k.relatives.length + 1);
    expect(overlaps(layout)).toBe(0);
  });
});
