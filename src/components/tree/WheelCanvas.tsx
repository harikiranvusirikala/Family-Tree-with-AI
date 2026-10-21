"use client";

import { useContext, useEffect, useMemo, useRef, type RefObject } from "react";
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KIN_GROUPS, kinGroup, relationName, type Kinship, type NameStyle, type Side } from "@/tree/kinship";
import { labelBox, lineStart } from "@/tree/network";
import type { Person } from "@/tree/types";
import { WHEEL_LABEL_HEIGHT, WHEEL_LABEL_WIDTH, layoutWheel } from "@/tree/wheel";
import { formatYears } from "@/tree/years";
import { isPhone, isTabletOrPhone } from "../screen";
import { useTheme } from "../theme";
import { CanvasActionsContext, type CanvasActions } from "./canvas-actions";
import type { CapturePicture } from "./FamilyCanvas";
import { READABLE_ZOOM, revealViewport } from "./framing";
import { PersonPhoto } from "./PersonPhoto";
import { sheetPicture } from "./sheet-picture";

const GREY = "#a1a1aa"; // zinc-400: reads on the day and night canvas alike, and in the picture

const SIDE_WORDS: Record<Side, string> = {
  up: "Ancestors",
  right: "Wives, husbands and their families",
  down: "Descendants",
  left: "Brothers, sisters, aunts, uncles, cousins",
};
const ringWord = (ring: number) => (ring === 1 ? "Closest" : `${ring} steps`);

const nodeWidth = (size: number) => Math.max(size, WHEEL_LABEL_WIDTH);

type KinNodeType = Node<{ person: Person; size: number; relation: string | null }, "kin">;
type RingsNodeType = Node<{ rings: number[]; sides: Partial<Record<Side, number>>; radius: number }, "rings">;
type LineType = Edge<{ x1: number; y1: number; x2: number; y2: number }, "line">;

/** Invisible connection points: the lines are drawn from the layout's centres, but React Flow needs them. */
function Handles() {
  return (
    <>
      <Handle type="source" position={Position.Top} isConnectable={false} className="!opacity-0" />
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
    </>
  );
}

/** A person on the wheel: photo or initials, name, and how they're related to the middle (none for the middle). */
function KinNode({ data }: NodeProps<KinNodeType>) {
  const { person, size, relation } = data;
  const { onPerson, selectedId } = useContext(CanvasActionsContext);
  const years = formatYears(person.birthYear, person.deathYear);
  const centre = relation === null;
  return (
    <div data-testid="wheel-person" data-person-id={person.id} className="relative flex flex-col items-center text-center" style={{ width: nodeWidth(size), height: size + WHEEL_LABEL_HEIGHT + 4 }}>
      {onPerson && (
        <button
          type="button"
          aria-label={years ? `${person.name}, ${years}` : person.name}
          aria-pressed={selectedId === person.id}
          onClick={() => onPerson(person.id)}
          className="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-amber-500"
        />
      )}
      <div className={`rounded-full ${centre ? "ring-4 ring-amber-400" : selectedId === person.id ? "ring-2 ring-amber-400" : ""}`}>
        <PersonPhoto person={person} size={size} />
      </div>
      <div className="mt-1 w-full truncate text-[13px] font-semibold leading-[18px] tracking-tight text-zinc-900 dark:text-zinc-100">{person.name}</div>
      <div data-testid="relation" className="w-full truncate text-xs leading-4 text-zinc-500 dark:text-zinc-400">
        {centre ? years : relation}
      </div>
      <Handles />
    </div>
  );
}

/** The rings and the sides' words, faint, behind everyone. */
function RingsNode({ data }: NodeProps<RingsNodeType>) {
  const { rings, sides, radius } = data;
  const size = 2 * radius;
  return (
    <svg width={size} height={size} viewBox={`${-radius} ${-radius} ${size} ${size}`} aria-hidden className="pointer-events-none">
      {rings.map((r, i) => (
        <g key={r}>
          <circle r={r} fill="none" strokeDasharray="4 6" className="stroke-zinc-300 dark:stroke-zinc-700" />
          <text x={r * Math.cos(-Math.PI / 3)} y={r * Math.sin(-Math.PI / 3) - 6} className="fill-zinc-400 text-[12px] dark:fill-zinc-500">
            {ringWord(i + 1)}
          </text>
        </g>
      ))}
      {Object.entries(sides).map(([side, angle]) => {
        const at = (rings[rings.length - 1] ?? 0) + 70;
        return (
          <text key={side} x={at * Math.cos(angle)} y={at * Math.sin(angle)} textAnchor="middle" className="fill-zinc-400 text-[13px] font-semibold uppercase tracking-widest dark:fill-zinc-500">
            {SIDE_WORDS[side as Side]}
          </text>
        );
      })}
    </svg>
  );
}

function Line({ data }: EdgeProps<LineType>) {
  const { x1, y1, x2, y2 } = data!;
  return <path d={`M ${x1},${y1} L ${x2},${y2}`} fill="none" stroke={GREY} strokeWidth={1.25} className="wheel-line" />;
}

const nodeTypes = { kin: KinNode, rings: RingsNode };
const edgeTypes = { line: Line };
const keepNodesClickable = () => {};

function along(x1: number, y1: number, x2: number, y2: number, by: number) {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  return { x: x1 + ((x2 - x1) * by) / length, y: y1 + ((y2 - y1) * by) / length };
}

function Wheel({ kin, style, captureRef }: { kin: Kinship; style: NameStyle; captureRef?: RefObject<CapturePicture | null> }) {
  const { selectedId } = useContext(CanvasActionsContext);
  const theme = useTheme() ?? "light";
  const { fitBounds, fitView, getNodes, getNode, getViewport, setCenter, setViewport } = useReactFlow();
  const flow = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => layoutWheel(kin), [kin]);
  const framedCentre = useRef<string | null>(null);

  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () => sheetPicture(flow.current!, getNodes());
    return () => {
      captureRef.current = null;
    };
  }, [captureRef, getNodes]);

  const relationOf = useMemo(() => new Map(kin.relatives.map((r) => [r.person.id, relationName(kin.centre, r.path, style)])), [kin, style]);
  const people = useMemo(() => [kin.centre, ...kin.relatives.map((r) => r.person)], [kin]);

  const nodes = useMemo<(KinNodeType | RingsNodeType)[]>(() => {
    const radius = (layout.rings[layout.rings.length - 1] ?? 0) + 160;
    return [
      { id: "rings", type: "rings", position: { x: -radius, y: -radius }, width: 2 * radius, height: 2 * radius, data: { rings: layout.rings, sides: layout.sides, radius }, zIndex: -1, selectable: false, focusable: false, draggable: false },
      ...people.map((person): KinNodeType => {
        const place = layout.places.get(person.id)!;
        const width = nodeWidth(place.size);
        return {
          id: person.id,
          type: "kin",
          position: { x: place.x - width / 2, y: place.y - place.size / 2 },
          width,
          height: place.size + WHEEL_LABEL_HEIGHT + 4,
          data: { person, size: place.size, relation: person.id === kin.centre.id ? null : (relationOf.get(person.id) ?? "") },
        };
      }),
    ];
  }, [layout, people, kin.centre.id, relationOf]);

  // A line from each person to the relative they're connected through, stopping at circles and names.
  const edges = useMemo<LineType[]>(() => {
    const label = (person: Person) => ({ width: Math.min(WHEEL_LABEL_WIDTH, Math.max(labelBox(person.name).width, 7 * (relationOf.get(person.id)?.length ?? 0))), height: WHEEL_LABEL_HEIGHT });
    return kin.relatives.map((r): LineType => {
      const via = r.path.length > 1 ? r.path[r.path.length - 2].person : kin.centre;
      const [a, b] = [layout.places.get(via.id)!, layout.places.get(r.person.id)!];
      const start = along(a.x, a.y, b.x, b.y, lineStart(a.size, label(via), b.x - a.x, b.y - a.y));
      const end = along(b.x, b.y, a.x, a.y, lineStart(b.size, label(r.person), a.x - b.x, a.y - b.y));
      // Keyed by the middle, so a new middle's lines are new and fade in while everyone glides.
      return { id: `${kin.centre.id}:${r.person.id}`, type: "line", source: via.id, target: r.person.id, data: { x1: start.x, y1: start.y, x2: end.x, y2: end.y } };
    });
  }, [kin, layout, relationOf]);

  // The first view, readable: the closest two rings on computers and tablets; on phones, the middle at the
  // readable zoom, with as much of the closest ring as fits. A new middle later keeps the zoom and moves
  // the view back to the middle while everyone glides there.
  useEffect(() => {
    if (!flow.current) return;
    if (framedCentre.current === null) {
      framedCentre.current = kin.centre.id;
      requestAnimationFrame(() => {
        if (isPhone()) return void setCenter(0, 0, { zoom: READABLE_ZOOM });
        const ring = layout.rings[Math.min(1, layout.rings.length - 1)];
        if (ring === undefined) return void fitView({ padding: 0.2 });
        const r = ring + WHEEL_LABEL_WIDTH / 2 + 8; // the ring and the names on it
        void fitBounds({ x: -r, y: -r, width: 2 * r, height: 2 * r }, { padding: 0.02 });
      });
    } else if (framedCentre.current !== kin.centre.id) {
      framedCentre.current = kin.centre.id;
      void setCenter(0, 0, { zoom: getViewport().zoom, duration: 450 });
    }
  }, [kin.centre.id, layout, fitBounds, fitView, getViewport, setCenter]);

  // Phones and tablets: bring the chosen person into view, above a phone's panel.
  useEffect(() => {
    if (!selectedId || !flow.current || !isTabletOrPhone()) return;
    const node = getNode(selectedId);
    if (!node) return;
    const card = { ...node.position, width: node.width ?? 0, height: node.height ?? 0 };
    const next = revealViewport(card, getViewport(), flow.current.getBoundingClientRect(), isPhone() ? undefined : 0);
    if (next) void setViewport(next, { duration: 250 });
  }, [selectedId, getNode, getViewport, setViewport]);

  return (
    <>
      <ReactFlow
        ref={flow}
        className="wheel-canvas"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={keepNodesClickable}
        minZoom={0.05}
        colorMode={theme}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} color={theme === "dark" ? "#3f3f46" : "#e4e4e7"} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <Summary kin={kin} />
    </>
  );
}

/** How many relatives of each kind, and who isn't related (computers only; not in the picture). */
function Summary({ kin }: { kin: Kinship }) {
  const counts = new Map<string, number>();
  for (const r of kin.relatives) counts.set(kinGroup(r.path), (counts.get(kinGroup(r.path)) ?? 0) + 1);
  return (
    <section aria-label="Relatives" className="absolute left-3 top-3 z-10 hidden w-60 flex-col gap-1 rounded-lg border border-zinc-200 bg-white/90 p-3 text-xs text-zinc-600 shadow-sm lg:flex dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-400">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{kin.centre.name}&apos;s relatives</h3>
      <dl className="flex flex-col gap-0.5">
        {KIN_GROUPS.filter((g) => counts.has(g.id)).map((g) => (
          <div key={g.id} className="flex justify-between gap-2">
            <dt>{g.label}</dt>
            <dd className="tabular-nums">{counts.get(g.id)}</dd>
          </div>
        ))}
        {kin.unrelated.length > 0 && (
          <div className="flex justify-between gap-2 border-t border-zinc-200 pt-1 dark:border-zinc-800">
            <dt>Not related through anyone</dt>
            <dd className="tabular-nums">{kin.unrelated.length}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/**
 * ★ Everyone's Wheel (part 4 of an owner request after the final check): `kin.centre` in the middle and
 * everyone related around them, one ring per step, each labelled with the relation in `style` (Telugu
 * names in English letters, or English). Like the other canvases: `actions` make it clickable,
 * `captureRef` makes the picture.
 */
export function WheelCanvas({ kin, style, actions, captureRef }: { kin: Kinship; style: NameStyle; actions?: CanvasActions; captureRef?: RefObject<CapturePicture | null> }) {
  return (
    <ReactFlowProvider>
      <CanvasActionsContext value={actions ?? {}}>
        <Wheel kin={kin} style={style} captureRef={captureRef} />
      </CanvasActionsContext>
    </ReactFlowProvider>
  );
}
