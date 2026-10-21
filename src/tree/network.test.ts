// @vitest-environment node
import { describe, expect, test } from "vitest";
import { sampleState, toGroupTree } from "@test/planning";
import { generateFamily } from "@test/fixtures/generated";
import type { GroupTree } from "./types";
import { circleSize, labelBox, layoutNetwork, networkGraph, networkRelatives, personReach, type NetworkGraph, type NetworkPositions } from "./network";

const tree = toGroupTree(sampleState());
const graph = networkGraph(tree);
const idOf = (name: string, t: GroupTree = tree) => t.persons.find((p) => p.name === name)!.id;
const noPause = () => Promise.resolve();

/** People whose circle or name overlaps another's: pairs of names. */
function overlaps(g: NetworkGraph, at: NetworkPositions): string[] {
  const boxes = g.persons.map((p) => {
    const c = at.get(p.person.id)!;
    const label = labelBox(p.person.name);
    const width = Math.max(p.size, label.width);
    return { name: p.person.name, x: c.x - width / 2, y: c.y - p.size / 2, width, height: p.size + label.height };
  });
  const found: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) found.push(`${a.name} / ${b.name}`);
    }
  }
  return found;
}

describe("★ Everyone's Network (owner request)", () => {
  test("everyone, a heart for each couple, partners linked to their heart and children to their parents' heart", () => {
    expect(graph.persons).toHaveLength(36);
    expect(graph.hearts).toHaveLength(12);
    expect(graph.links.filter((l) => l.kind === "partner")).toHaveLength(24);
    expect(graph.links.filter((l) => l.kind === "child")).toHaveLength(23); // everyone with parents
    const steve = idOf("Steve Cruz");
    const sammie = graph.hearts.find((h) => h.partnerIds.includes(steve) && h.partnerIds.includes(idOf("Sammie Chang")))!;
    expect(sammie.divorced).toBe(true);
    expect(graph.links.find((l) => l.target === idOf("William Cruz") && l.kind === "child")?.source).toBe(sammie.id);
  });

  test("bigger circles have more relations: parents, partners and children", () => {
    expect([0, 1, 2, 8, 20].map(circleSize)).toEqual([44, 44, 50, 86, 88]);
    const of = (name: string) => graph.persons.find((p) => p.person.name === name)!;
    expect(of("Steve Cruz")).toMatchObject({ relations: 7, size: 80 }); // 2 parents, 2 partners, 3 children
    expect(of("Alex Cruz")).toMatchObject({ relations: 2, size: 50 });
  });

  test("a single parent's arrow starts at them", () => {
    const one: GroupTree = {
      persons: [
        { id: "mum", name: "Mum", gender: "female" },
        { id: "kid", name: "Kid", gender: "male" },
      ],
      unions: [{ id: "u", partnerIds: ["mum"], status: "married", childIds: ["kid"] }],
      sheets: [],
    };
    expect(networkGraph(one)).toMatchObject({ hearts: [], links: [{ kind: "child", source: "mum", target: "kid" }] });
  });

  test("choosing someone lights up their parents, partners and children, with their hearts and lines", () => {
    const { nodes, links } = networkRelatives(graph, idOf("Steve Cruz"));
    const names = [...nodes].flatMap((id) => tree.persons.find((p) => p.id === id)?.name ?? []).sort();
    expect(names).toEqual(["Anna Cruz", "Arham Chopra", "Arjun Patel", "Olivia Cruz", "Sammie Chang", "Steve Cruz", "Taylor Cruz", "William Cruz"]);
    expect(nodes.size - names.length).toBe(3); // his parents' heart and his two
    expect(links.size).toBe(10);
  });

  test("the arrangement: nobody overlaps, the same every time, and children below their parents", async () => {
    const at = await layoutNetwork(graph, noPause);
    expect(at.size).toBe(48);
    expect(overlaps(graph, at)).toEqual([]);
    expect([...(await layoutNetwork(graph, noPause)).entries()]).toEqual([...at.entries()]);
    for (const link of graph.links.filter((l) => l.kind === "child")) {
      expect(at.get(link.target)!.y, `${link.target} below ${link.source}`).toBeGreaterThan(at.get(link.source)!.y);
    }
  });

  test("a family not joined to the rest stays nearby", async () => {
    const more: GroupTree = {
      ...tree,
      persons: [...tree.persons, { id: "ravi", name: "Ravi Rao", gender: "male" }, { id: "priya", name: "Priya Rao", gender: "female" }],
      unions: [...tree.unions, { id: "rao", partnerIds: ["ravi", "priya"], status: "married", childIds: [] }],
    };
    const g = networkGraph(more);
    const at = await layoutNetwork(g, noPause);
    const xs = [...at.values()].map((p) => p.x);
    const ys = [...at.values()].map((p) => p.y);
    const others = tree.persons.map((p) => at.get(p.id)!);
    const width = Math.max(...others.map((p) => p.x)) - Math.min(...others.map((p) => p.x));
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(width + 600);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(3000);
    expect(overlaps(g, at)).toEqual([]);
  });

  // Regression guards, not benchmarks: about 0.35 s and 4 s on a recent laptop (ELK's took 40 s for 300).
  const slow = process.env.CI ? 3 : 1;
  test("300 people are arranged quickly, with nobody overlapping", async () => {
    const big = networkGraph({ ...generateFamily(300).data, sheets: [] });
    const start = performance.now();
    const at = await layoutNetwork(big, noPause);
    expect(performance.now() - start).toBeLessThan(1500 * slow);
    expect(overlaps(big, at)).toEqual([]);
  });

  test("2,000 people are arranged in seconds, nearly all clear of each other", async () => {
    const big = networkGraph({ ...generateFamily(2000).data, sheets: [] });
    const start = performance.now();
    const at = await layoutNetwork(big, noPause);
    expect(performance.now() - start).toBeLessThan(10_000 * slow);
    expect(overlaps(big, at).length).toBeLessThan(20); // pairs, out of two million
  }, 60_000);
});

describe("the Network's lines (owner request)", () => {
  const entry = graph.persons.find((p) => p.person.name === "Steve Cruz")!; // an 80 px circle, a one-line name
  const name = labelBox("Steve Cruz");

  test("a line starts at the circle, or below the name when it leaves downwards through it", () => {
    expect(personReach(entry, 1, 0)).toBe(40); // sideways
    expect(personReach(entry, 0, -1)).toBe(40); // upwards
    expect(personReach(entry, 0, 1)).toBeCloseTo(40 + 2 + name.height + 2); // straight down, past the name
    expect(personReach(entry, 1, 0.3)).toBe(40); // down but beside the name
    const steep = personReach(entry, 0.3, 1);
    expect(steep).toBeGreaterThan(40 + name.height);
  });
});
