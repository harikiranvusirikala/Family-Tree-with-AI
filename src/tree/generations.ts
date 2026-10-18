import type { SheetView } from "./types";

/**
 * Generation number for each person: partners share a generation, children are one below
 * their parents. Numbers are relative within each connected family (the first person found is 0).
 * If the data is contradictory (e.g. someone marries into an older generation), the first value wins.
 */
export function computeGenerations(view: SheetView): Map<string, number> {
  const related = new Map<string, { id: string; delta: number }[]>(view.persons.map((p) => [p.id, []]));
  for (const u of view.unions) {
    for (const a of u.partnerIds) {
      for (const b of u.partnerIds) if (a !== b) related.get(a)!.push({ id: b, delta: 0 });
      for (const c of u.childIds) {
        related.get(a)!.push({ id: c, delta: 1 });
        related.get(c)!.push({ id: a, delta: -1 });
      }
    }
  }
  const generation = new Map<string, number>();
  for (const { id } of view.persons) {
    if (generation.has(id)) continue;
    generation.set(id, 0);
    const queue = [id];
    while (queue.length) {
      const current = queue.shift()!;
      for (const { id: next, delta } of related.get(current)!) {
        if (!generation.has(next)) {
          generation.set(next, generation.get(current)! + delta);
          queue.push(next);
        }
      }
    }
  }
  return generation;
}
