// ★ Everyone's Network (part 3 of an owner request after the final check): everyone and every relation
// on one canvas. Who is drawn comes from everyoneView, like the Tree; the arrangement is a force layout
// (d3-force), because ELK's took about 40 s for 300 people (BUILD_PLAN.md, part 3).
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { everyoneView } from "./everyone";
import { computeGenerations } from "./generations";
import type { GroupTree, Person } from "./types";

/** A circle's width: 44 px for one relation or none, 6 px more for each further one, up to 88. */
export const circleSize = (relations: number) => Math.min(88, 44 + 6 * Math.max(0, relations - 1));
/** The name under a circle: at most this wide (longer names wrap), this tall for one line. */
export const LABEL_WIDTH = 112;
export const LABEL_HEIGHT = 20;
/** A heart on a couple's line. */
export const HEART_SIZE = 22;

export interface NetworkPerson {
  person: Person;
  /** Parents, partners and children. */
  relations: number;
  size: number;
  /** Within their connected family, 0 for the first person found; parents one less, children one more. */
  generation: number;
}

/** A couple's heart, which their line passes through and their children's arrows start from. */
export interface NetworkHeart {
  id: string;
  partnerIds: [string, string];
  divorced: boolean;
}

/** A partner to their couple's heart, or a heart (a single parent) to a child. */
export interface NetworkLink {
  id: string;
  kind: "partner" | "child";
  source: string;
  target: string;
}

export interface NetworkGraph {
  persons: NetworkPerson[];
  hearts: NetworkHeart[];
  links: NetworkLink[];
}

/** Everyone, every couple's heart and every link, from the loaded group. */
export function networkGraph(tree: GroupTree): NetworkGraph {
  const view = everyoneView(tree);
  const relations = new Map(view.persons.map((p) => [p.id, 0]));
  const count = (id: string) => relations.set(id, relations.get(id)! + 1);
  const hearts: NetworkHeart[] = [];
  const links: NetworkLink[] = [];
  for (const union of view.unions) {
    const couple = union.partnerIds.length === 2;
    if (couple) {
      const [a, b] = union.partnerIds as [string, string];
      hearts.push({ id: union.id, partnerIds: [a, b], divorced: union.status === "divorced" });
      links.push({ id: `${a}-${union.id}`, kind: "partner", source: a, target: union.id }, { id: `${b}-${union.id}`, kind: "partner", source: b, target: union.id });
      count(a);
      count(b);
    }
    // The heart joins a couple and their children, as on the Tree; a single parent's arrow starts at them.
    const from = couple ? union.id : union.partnerIds[0];
    for (const child of union.childIds) {
      links.push({ id: `${from}>${child}`, kind: "child", source: from, target: child });
      for (const parent of union.partnerIds) {
        count(parent);
        count(child);
      }
    }
  }
  const generations = computeGenerations(view);
  return {
    persons: view.persons.map((person) => {
      const n = relations.get(person.id)!;
      return { person, relations: n, size: circleSize(n), generation: generations.get(person.id) ?? 0 };
    }),
    hearts,
    links,
  };
}

/** The relatives of someone chosen, lit up while everyone else fades: themselves, their hearts and lines. */
export function networkRelatives(graph: NetworkGraph, personId: string): { nodes: Set<string>; links: Set<string> } {
  const nodes = new Set([personId]);
  const links = new Set<string>();
  // Their couples' hearts and their parents' heart (or a single parent), then everyone linked to those.
  const ownHearts = new Set(graph.hearts.filter((h) => h.partnerIds.includes(personId)).map((h) => h.id));
  const parentHeart = graph.links.find((l) => l.kind === "child" && l.target === personId)?.source;
  for (const link of graph.links) {
    const viaOwn = ownHearts.has(link.target) || ownHearts.has(link.source); // a partner, or a child
    const viaParents = parentHeart !== undefined && (link.target === parentHeart || link.id === `${parentHeart}>${personId}`); // a parent
    if (viaOwn || viaParents || link.source === personId || link.target === personId) {
      links.add(link.id);
      nodes.add(link.source);
      nodes.add(link.target);
    }
  }
  return { nodes, links };
}

/** Where everyone and every heart is: centres, from the layout. */
export type NetworkPositions = Map<string, { x: number; y: number }>;

/**
 * The room a name takes under its circle, estimated from its length (the layout can't measure text):
 * up to LABEL_WIDTH wide, then a second line (the canvas cuts longer names off after two).
 */
export function labelBox(name: string): { width: number; height: number } {
  const width = 7.2 * name.length + 10;
  return { width: Math.min(width, LABEL_WIDTH), height: LABEL_HEIGHT * Math.min(2, Math.ceil(width / LABEL_WIDTH)) };
}

/** The space kept around a person's centre: a circle around their photo and their name, plus a gap. */
export function personRadius(p: NetworkPerson): number {
  const label = labelBox(p.person.name);
  return Math.hypot(Math.max(p.size, label.width) / 2, p.size / 2 + label.height) + 4;
}

/**
 * How far from a person's centre a line towards (dx, dy) starts: at their circle, or below their name
 * when it leaves downwards through it (usually to their own heart), so it doesn't cross the name.
 */
export function personReach(entry: NetworkPerson, dx: number, dy: number) {
  const radius = entry.size / 2;
  const length = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / length, dy / length];
  if (uy <= 0) return radius;
  const label = labelBox(entry.person.name);
  const halfWidth = label.width / 2;
  if (Math.abs(ux) * (radius / uy) > halfWidth) return radius; // passes beside the name
  const out = Math.min((radius + 2 + label.height) / uy, ux === 0 ? Infinity : halfWidth / Math.abs(ux));
  return Math.max(radius, out + 2);
}

const ROW = 190; // between generations, which a gentle pull puts above one another
const PARTNER_DISTANCE = 58; // a partner to their heart
const CHILD_DISTANCE = 120; // a heart to a child
const TICKS = 120; // steps while everything moves, then RELAX steps that only push overlapping people apart
const RELAX = 80;
const SLICE = 20; // steps between pauses

type LayoutNode = SimulationNodeDatum & { id: string; radius: number; row: number };

/**
 * The arrangement: linked people pull together, everyone pushes apart, circles keep clear of each
 * other, and older generations are pulled towards the top; then a last pass only pushes overlapping
 * people apart. d3-force starts from a fixed spiral and seeds its own random numbers, so the same family
 * always comes out the same. Done in slices, with a pause between them (`pause`), so a big group
 * doesn't freeze the page: about 0.35 s for 300 people and 4 s for 2,000 (BUILD_PLAN.md, part 3).
 */
export async function layoutNetwork(graph: NetworkGraph, pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0))): Promise<NetworkPositions> {
  const rowOf = new Map(graph.persons.map((p) => [p.person.id, p.generation]));
  const nodes: LayoutNode[] = [
    ...graph.persons.map((p) => ({ id: p.person.id, radius: personRadius(p), row: p.generation })),
    // A heart sits on its couple's row, a little below the circles' centres.
    ...graph.hearts.map((h) => ({ id: h.id, radius: HEART_SIZE / 2 + 4, row: Math.max(...h.partnerIds.map((id) => rowOf.get(id) ?? 0)) + 0.15 })),
  ];
  const links: (SimulationLinkDatum<LayoutNode> & NetworkLink)[] = graph.links.map((l) => ({ ...l }));
  const simulation = forceSimulation(nodes)
    .stop()
    .alphaDecay(1 - Math.pow(0.001, 1 / TICKS))
    .force(
      "link",
      forceLink<LayoutNode, (typeof links)[number]>(links)
        .id((n) => n.id)
        .distance((l) => (l.kind === "partner" ? PARTNER_DISTANCE : CHILD_DISTANCE))
        .strength(0.8),
    )
    .force("charge", forceManyBody<LayoutNode>().strength(-300).distanceMax(900).theta(1.2))
    .force("collide", forceCollide<LayoutNode>((n) => n.radius))
    .force("generation", forceY<LayoutNode>((n) => n.row * ROW).strength(0.3))
    .force("x", forceX<LayoutNode>(0).strength(0.015)); // keeps families not joined to the rest nearby
  const run = async (steps: number) => {
    for (let done = 0; done < steps; done += SLICE) {
      simulation.tick(Math.min(SLICE, steps - done));
      await pause();
    }
  };
  await run(TICKS);
  simulation.force("link", null).force("charge", null).force("generation", null).force("x", null);
  simulation.force("collide", forceCollide<LayoutNode>((n) => n.radius).iterations(3));
  await run(RELAX);
  return new Map(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
}
