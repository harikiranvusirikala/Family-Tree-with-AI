import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs/lib/elk-api";
import type { Person, SheetView, Union } from "../types";
import { birthOrder } from "../years";
import { finishLayout } from "./shared";

/** For eldest-first orders: by birth, full dates where known (an owner request); unknown last. */
const eldest = (p: Person | undefined) => (p && birthOrder(p)) ?? Infinity;
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

function byBirth(persons: Map<string, Person>) {
  return (a: string, b: string) =>
    eldest(persons.get(a)) - eldest(persons.get(b));
}

/**
 * Strict sibling order (stored sheets, an owner request): a model order for ELK's second pass in which
 * every couple's children come eldest first, left to right, each carrying their whole family. Built from
 * the first, crossing-free pass (`x`): a child's family is every block below them reached only through
 * them. A child whose family is also tied to another family above (a partner whose parents are on the
 * sheet, only possible through a sheet's extra people) keeps its place, so no line crosses.
 */
function strictOrder(view: SheetView, blocks: Block[], blockOf: Map<string, Block>, x: Map<string, number>, y: Map<string, number>, eldestFirst: (a: string, b: string) => number): Block[] {
  const parentUnionOf = new Map<string, Union>();
  for (const u of view.unions) for (const c of u.childIds) parentUnionOf.set(c, u);
  const ties = (b: Block) => new Set(b.members.flatMap((m) => parentUnionOf.get(m)?.id ?? []));
  /** The blocks each block's couples have children in. */
  const below = new Map<Block, Block[]>(blocks.map((b) => [b, []]));
  for (const u of view.unions) {
    const parent = blockOf.get(u.partnerIds[0])!;
    for (const c of u.childIds) {
      const child = blockOf.get(c)!;
      if (child !== parent && !below.get(parent)!.includes(child)) below.get(parent)!.push(child);
    }
  }
  const family = (root: Block) => {
    const all = [root];
    for (let i = 0; i < all.length; i++) for (const b of below.get(all[i])!) if (!all.includes(b)) all.push(b);
    return all;
  };
  const key = new Map(blocks.map((b) => [b, x.get(b.id)!]));
  const right = (bs: Block[]) => Math.max(...bs.map((b) => key.get(b)! + widthOf(b)));
  const left = (bs: Block[]) => Math.min(...bs.map((b) => key.get(b)!));

  // From the top down, so a family moved with its parent is ordered again inside its new place.
  const unions = [...view.unions].filter((u) => u.childIds.length > 1).sort((a, b) => y.get(blockOf.get(a.partnerIds[0])!.id)! - y.get(blockOf.get(b.partnerIds[0])!.id)!);
  for (const u of unions) {
    const parent = blockOf.get(u.partnerIds[0])!;
    const movable = [...new Set(u.childIds)]
      .map((c) => ({ c, block: blockOf.get(c)! }))
      .filter(({ block }) => block !== parent && ties(block).size === 1)
      .map((m) => ({ ...m, family: family(m.block) }))
      .filter((m) => m.family.slice(1).every((b) => ties(b).size === 1));
    if (movable.length < 2) continue;
    let cursor = Math.min(...movable.map((m) => left(m.family)));
    for (const m of [...movable].sort((a, b) => eldestFirst(a.c, b.c))) {
      const shift = cursor - left(m.family);
      for (const b of m.family) key.set(b, key.get(b)! + shift);
      cursor = right(m.family) + 48;
    }
  }
  return [...blocks].sort((a, b) => key.get(a)! - key.get(b)! || x.get(a.id)! - x.get(b.id)!);
}

export const elkEngine: LayoutEngine = {
  name: "ELK.js",
  async layout(view, options = {}) {
    const personById = new Map(view.persons.map((p) => [p.id, p]));
    const parentUnionOf = new Map<string, Union>();
    for (const u of view.unions) for (const c of u.childIds) parentUnionOf.set(c, u);

    const hasParents = new Set(parentUnionOf.keys());
    // Input order in birth order nudges ELK towards eldest-first; orderFreeSiblings() finishes the job.
    const birthOf = (b: Block) => eldest(personById.get(b.members.find((m) => hasParents.has(m)) ?? b.members[0]));
    const blocks = buildBlocks(view, hasParents).sort((a, b) => birthOf(a) - birthOf(b));
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
      for (const c of [...u.childIds].sort(byBirth(personById))) {
        if (blockOf.get(c) === block) continue; // never happens in real families; avoid a self-loop
        edges.push({ id: `e:${u.id}:${c}`, sources: [`out:${u.id}`], targets: [`in:${c}`] });
      }
    }

    /** One ELK run over `ordered` blocks; `forced` keeps that order in every row. */
    const run = async (ordered: Block[], forced: boolean) => {
      const rank = new Map(ordered.map((b, i) => [b.id, i]));
      const graph: ElkNode = {
        id: "root",
        layoutOptions: forced ? { ...ELK_OPTIONS, "elk.layered.crossingMinimization.forceNodeModelOrder": "true" } : ELK_OPTIONS,
        children: ordered.map((b) => ({
          id: b.id,
          width: widthOf(b),
          height: CARD_HEIGHT,
          ports: ports.get(b.id),
          layoutOptions: { "elk.portConstraints": "FIXED_POS" },
        })),
        edges: forced ? [...edges].sort((a, b) => rank.get(blockOf.get(a.targets[0].slice(3))!.id)! - rank.get(blockOf.get(b.targets[0].slice(3))!.id)!) : edges,
      };
      const result = await elk.layout(graph);
      const x = new Map<string, number>();
      const y = new Map<string, number>();
      for (const n of result.children ?? []) {
        x.set(n.id, n.x ?? 0);
        y.set(n.id, n.y ?? 0);
      }
      return { x, y };
    };

    let { x, y } = await run(blocks, false);
    const birth = (id: string) => eldest(personById.get(id));
    // Eldest first; the same date (or none), A to Z by name, as the panels list children.
    const byAge = (a: string, b: string) => birth(a) - birth(b) || (personById.get(a)?.name ?? "").localeCompare(personById.get(b)?.name ?? "");
    if (options.strictSiblings) ({ x, y } = await run(strictOrder(view, blocks, blockOf, x, y, byAge), true));
    orderFreeSiblings(view, blocks, blockOf, x, y, birth);

    const persons: PositionedPerson[] = view.persons.map((p) => {
      const block = blockOf.get(p.id)!;
      return { id: p.id, x: x.get(block.id)! + offsetOf.get(p.id)!, y: y.get(block.id)! };
    });
    return finishLayout(view, persons);
  },
};
