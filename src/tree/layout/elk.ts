import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs/lib/elk-api";
import type { Person, SheetView, Union } from "../types";
import { finishLayout } from "./shared";
import { CARD_HEIGHT, CARD_WIDTH, HEART_GAP, ROW_GAP, type LayoutEngine, type PositionedPerson } from "./types";

const elk = new ELK();

const ELK_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "48",
  "elk.layered.spacing.nodeNodeBetweenLayers": String(ROW_GAP),
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
};
const STEP = CARD_WIDTH + HEART_GAP;

/**
 * A block of partners drawn side by side: a couple, or a chain such as ex-partner – person – partner.
 * Each block is one ELK node, so partners can never be pulled apart.
 */
interface Block {
  id: string;
  members: string[];
}

function buildBlocks(view: SheetView, hasParents: Set<string>): Block[] {
  const neighbours = new Map<string, string[]>(view.persons.map((p) => [p.id, []]));
  for (const u of view.unions) {
    if (u.partnerIds.length !== 2) continue;
    const [a, b] = u.partnerIds;
    if (!neighbours.get(a)!.includes(b)) neighbours.get(a)!.push(b);
    if (!neighbours.get(b)!.includes(a)) neighbours.get(b)!.push(a);
  }

  const seen = new Set<string>();
  const blocks: Block[] = [];
  for (const { id } of view.persons) {
    if (seen.has(id)) continue;
    // Collect everyone joined to this person through partnerships.
    const component: string[] = [];
    const queue = [id];
    seen.add(id);
    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      for (const n of neighbours.get(current)!) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    // Walk the partnership chain from one end. Anything off the chain (rare cycles) goes last.
    const start = component.find((p) => neighbours.get(p)!.length === 1) ?? component[0];
    const chain: string[] = [];
    for (let cur: string | undefined = start; cur; ) {
      chain.push(cur);
      cur = neighbours.get(cur)!.find((n) => !chain.includes(n));
    }
    const members = [...chain, ...component.filter((p) => !chain.includes(p))];
    // In a couple, put the person whose parents are on the sheet on the left.
    if (members.length === 2 && hasParents.has(members[1]) && !hasParents.has(members[0])) members.reverse();
    blocks.push({ id: `block:${members[0]}`, members });
  }
  return blocks;
}

const widthOf = (b: Block) => b.members.length * STEP - HEART_GAP;

/**
 * ELK avoids crossing lines but doesn't keep siblings in birth order. Siblings with nothing hanging
 * below them can move freely, so each run of them that sits side by side is re-packed eldest first
 * into the same space. Siblings with families of their own keep ELK's crossing-free position.
 */
function orderFreeSiblings(
  view: SheetView,
  blocks: Block[],
  blockOf: Map<string, Block>,
  x: Map<string, number>,
  y: Map<string, number>,
  birthYear: (id: string) => number,
) {
  const hasParents = new Set(view.unions.flatMap((u) => u.childIds));
  const hasChildren = new Set(view.unions.filter((u) => u.childIds.length > 0).flatMap((u) => u.partnerIds));
  const isFree = (b: Block) =>
    b.members.every((m) => !hasChildren.has(m)) && b.members.filter((m) => hasParents.has(m)).length === 1;

  for (const u of view.unions) {
    const childOf = new Map<Block, string>();
    for (const c of u.childIds) if (isFree(blockOf.get(c)!)) childOf.set(blockOf.get(c)!, c);
    if (childOf.size < 2) continue;

    for (const rowY of new Set([...childOf.keys()].map((b) => y.get(b.id)))) {
      const row = blocks.filter((b) => y.get(b.id) === rowY).sort((a, b) => x.get(a.id)! - x.get(b.id)!);
      let run: Block[] = [];
      const repack = () => {
        if (run.length > 1) {
          const gaps = run.slice(1).map((b, i) => x.get(b.id)! - x.get(run[i].id)! - widthOf(run[i]));
          let cursor = x.get(run[0].id)!;
          [...run]
            .sort((a, b) => birthYear(childOf.get(a)!) - birthYear(childOf.get(b)!))
            .forEach((b, i) => {
              x.set(b.id, cursor);
              cursor += widthOf(b) + (gaps[i] ?? 0);
            });
        }
        run = [];
      };
      for (const b of row) {
        if (childOf.has(b)) run.push(b);
        else repack();
      }
      repack();
    }
  }
}

function byBirthYear(persons: Map<string, Person>) {
  return (a: string, b: string) =>
    (persons.get(a)?.birthYear ?? Infinity) - (persons.get(b)?.birthYear ?? Infinity);
}

export const elkEngine: LayoutEngine = {
  name: "ELK.js",
  async layout(view) {
    const personById = new Map(view.persons.map((p) => [p.id, p]));
    const parentUnionOf = new Map<string, Union>();
    for (const u of view.unions) for (const c of u.childIds) parentUnionOf.set(c, u);

    const hasParents = new Set(parentUnionOf.keys());
    // Input order in birth order nudges ELK towards eldest-first; orderFreeSiblings() finishes the job.
    const birthYearOf = (b: Block) =>
      personById.get(b.members.find((m) => hasParents.has(m)) ?? b.members[0])?.birthYear ?? Infinity;
    const blocks = buildBlocks(view, hasParents).sort((a, b) => birthYearOf(a) - birthYearOf(b));
    const blockOf = new Map<string, Block>();
    const offsetOf = new Map<string, number>();
    for (const b of blocks) b.members.forEach((m, i) => (blockOf.set(m, b), offsetOf.set(m, i * STEP)));

    const ports = new Map<string, ElkPort[]>(blocks.map((b) => [b.id, []]));
    // Top port above each person whose parents are on the sheet.
    for (const child of parentUnionOf.keys()) {
      ports.get(blockOf.get(child)!.id)!.push({
        id: `in:${child}`, x: offsetOf.get(child)! + CARD_WIDTH / 2, y: 0, width: 0, height: 0,
        layoutOptions: { "elk.port.side": "NORTH" },
      });
    }
    // Bottom port under each heart (or under a single parent) that has children.
    const edges: ElkExtendedEdge[] = [];
    for (const u of view.unions) {
      if (u.childIds.length === 0) continue;
      const block = blockOf.get(u.partnerIds[0])!;
      const xs = u.partnerIds.map((p) => offsetOf.get(p)! + CARD_WIDTH / 2);
      ports.get(block.id)!.push({
        id: `out:${u.id}`, x: (Math.min(...xs) + Math.max(...xs)) / 2, y: CARD_HEIGHT, width: 0, height: 0,
        layoutOptions: { "elk.port.side": "SOUTH" },
      });
      for (const c of [...u.childIds].sort(byBirthYear(personById))) {
        if (blockOf.get(c) === block) continue; // never happens in real families; avoid a self-loop
        edges.push({ id: `e:${u.id}:${c}`, sources: [`out:${u.id}`], targets: [`in:${c}`] });
      }
    }

    const graph: ElkNode = {
      id: "root",
      layoutOptions: ELK_OPTIONS,
      children: blocks.map((b) => ({
        id: b.id,
        width: widthOf(b),
        height: CARD_HEIGHT,
        ports: ports.get(b.id),
        layoutOptions: { "elk.portConstraints": "FIXED_POS" },
      })),
      edges,
    };

    const result = await elk.layout(graph);
    const x = new Map<string, number>();
    const y = new Map<string, number>();
    for (const n of result.children ?? []) {
      x.set(n.id, n.x ?? 0);
      y.set(n.id, n.y ?? 0);
    }
    orderFreeSiblings(view, blocks, blockOf, x, y, (id) => personById.get(id)?.birthYear ?? Infinity);

    const persons: PositionedPerson[] = view.persons.map((p) => {
      const block = blockOf.get(p.id)!;
      return { id: p.id, x: x.get(block.id)! + offsetOf.get(p.id)!, y: y.get(block.id)! };
    });
    return finishLayout(view, persons);
  },
};
