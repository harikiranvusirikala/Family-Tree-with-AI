// ★ Everyone's Wheel (part 4 of an owner request after the final check): where everyone goes, around the
// person in the middle. One ring per step; ancestors up, partners and their families right, descendants
// down, brothers, sisters, aunts, uncles and cousins left. Pure, like the sheet and network layouts.
import { kinSide, type Kin, type Kinship, type Side } from "./kinship";

/** The person in the middle's circle. */
export const CENTRE_SIZE = 96;
/** A relative's circle: bigger when closer. */
export const wheelSize = (ring: number) => (ring === 1 ? 60 : ring === 2 ? 52 : 46);
/** The name and the relation under a circle: at most this wide, two lines. */
export const WHEEL_LABEL_WIDTH = 124;
export const WHEEL_LABEL_HEIGHT = 36;

// Neighbours on a ring, and on rings next to each other, are this far apart, so that their circles and
// names (WHEEL_LABEL_WIDTH by the circle and two lines) stay clear at any angle.
const ARC = 164;
const RING_GAP = 170;
const FIRST_RING = 190;

export interface WheelPlace {
  x: number;
  y: number;
  ring: number;
  size: number;
}

export interface WheelLayout {
  /** Centres, by person; the person in the middle is at 0, 0 (ring 0). */
  places: Map<string, WheelPlace>;
  /** The rings' radii: rings[0] is the closest ring's. */
  rings: number[];
  /** The middle of each side that has anyone (an angle, clockwise from the right), for its words. */
  sides: Partial<Record<Side, number>>;
}

/** Clockwise from the top. */
const SIDES: Side[] = ["up", "right", "down", "left"];
const TURN = 2 * Math.PI;

/**
 * Positions along a stretch of `length`, as close to `desired` (sorted) as they can be while keeping
 * neighbours at least `gap` apart and inside the stretch.
 */
function pack(desired: number[], gap: number, length: number): number[] {
  const n = desired.length;
  if (n * gap >= length) return desired.map((_, i) => ((i + 0.5) * length) / n); // full: evenly spread
  const [low, high] = [gap / 2, length - gap / 2];
  const out = desired.map((d) => Math.min(Math.max(d, low), high));
  for (let i = 1; i < n; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  if (out[n - 1] > high) {
    out[n - 1] = high;
    for (let i = n - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - gap);
  }
  return out;
}

/** Where everyone goes on the wheel around `kin.centre`. */
export function layoutWheel(kin: Kinship): WheelLayout {
  const places = new Map<string, WheelPlace>([[kin.centre.id, { x: 0, y: 0, ring: 0, size: CENTRE_SIZE }]]);
  const groups = new Map<string, Kin[]>(); // by ring and side
  const key = (ring: number, side: Side) => `${ring}:${side}`;
  let outer = 0;
  for (const r of kin.relatives) {
    const k = key(r.path.length, kinSide(r.path));
    groups.set(k, [...(groups.get(k) ?? []), r]);
    outer = Math.max(outer, r.path.length);
  }
  if (outer === 0) return { places, rings: [], sides: {} };
  const count = (ring: number, side: Side) => groups.get(key(ring, side))?.length ?? 0;
  const rings = Array.from({ length: outer }, (_, i) => i + 1);

  // Each side's share of the circle grows with its busiest ring, gently (a square root), so that a side
  // full of cousins doesn't push the others round. Then the sides, in order, are turned together so each
  // sits as near its own direction (up, right, down, left) as it can.
  const weight = Object.fromEntries(SIDES.map((s) => [s, Math.sqrt(Math.max(...rings.map((ring) => count(ring, s))))])) as Record<Side, number>;
  const total = SIDES.reduce((sum, s) => sum + weight[s], 0);
  const span = Object.fromEntries(SIDES.map((s) => [s, (TURN * weight[s]) / total])) as Record<Side, number>;
  const present = SIDES.filter((s) => span[s] > 0);
  let before = 0;
  const offsets = {} as Record<Side, number>; // each side's start, from the first side's
  for (const s of SIDES) {
    offsets[s] = before;
    before += span[s];
  }
  // The turn that best puts each side's middle on its direction (a mean of angles, on the circle).
  const direction = (s: Side) => -Math.PI / 2 + (SIDES.indexOf(s) * Math.PI) / 2;
  const turns = present.map((s) => direction(s) - offsets[s] - span[s] / 2);
  const turn = Math.atan2(turns.reduce((sum, t) => sum + Math.sin(t), 0), turns.reduce((sum, t) => sum + Math.cos(t), 0));
  const start = Object.fromEntries(SIDES.map((s) => [s, turn + offsets[s]])) as Record<Side, number>;

  // Each ring is far enough out for its busiest side's people to sit ARC apart.
  const radii: number[] = [];
  for (const ring of rings) {
    const roomy = Math.max(0, ...SIDES.filter((s) => span[s] > 0).map((s) => (count(ring, s) * ARC) / span[s]));
    radii.push(Math.max(ring === 1 ? FIRST_RING : radii[ring - 2] + RING_GAP, roomy));
  }

  // Ring by ring, each person near the relative they're connected through, then spaced apart.
  const angles = new Map<string, number>();
  for (const ring of rings) {
    const radius = radii[ring - 1];
    const gap = ARC / radius;
    for (const side of SIDES) {
      const people = groups.get(key(ring, side));
      if (!people) continue;
      /** Where `id` sits within this side's stretch: its angle there, or the nearer end. */
      const local = (id: string) => {
        const at = angles.get(id);
        if (at === undefined) return span[side] / 2; // the person in the middle
        const offset = (((at - start[side]) % TURN) + TURN) % TURN;
        if (offset <= span[side]) return offset;
        return offset - span[side] < TURN - offset ? span[side] : 0;
      };
      const byVia = new Map<string, Kin[]>();
      for (const r of people) {
        const via = r.path.length > 1 ? r.path[r.path.length - 2].person.id : kin.centre.id;
        byVia.set(via, [...(byVia.get(via) ?? []), r]);
      }
      // Brothers and sisters (of one relative) spread around that relative, eldest first.
      const wanted: { r: Kin; at: number }[] = [];
      for (const [via, kids] of byVia) {
        kids.sort((a, b) => (a.person.birthYear ?? 0) - (b.person.birthYear ?? 0) || a.person.name.localeCompare(b.person.name));
        kids.forEach((r, i) => wanted.push({ r, at: local(via) + (i - (kids.length - 1) / 2) * gap }));
      }
      wanted.sort((a, b) => a.at - b.at || a.r.person.id.localeCompare(b.r.person.id));
      const placed = pack(
        wanted.map((w) => w.at),
        gap,
        span[side],
      );
      wanted.forEach(({ r }, i) => {
        const theta = start[side] + placed[i];
        angles.set(r.person.id, theta);
        places.set(r.person.id, { x: radius * Math.cos(theta), y: radius * Math.sin(theta), ring, size: wheelSize(ring) });
      });
    }
  }
  const sides: Partial<Record<Side, number>> = {};
  for (const s of SIDES) if (span[s] > 0) sides[s] = start[s] + span[s] / 2;
  return { places, rings: radii, sides };
}
