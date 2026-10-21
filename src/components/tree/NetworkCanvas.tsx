"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CARD_HEIGHT, CARD_WIDTH } from "@/tree/layout";
import { HEART_SIZE, LABEL_HEIGHT, LABEL_WIDTH, layoutNetwork, networkGraph, networkRelatives, personReach, type NetworkGraph, type NetworkHeart, type NetworkPerson, type NetworkPositions } from "@/tree/network";
import type { GroupTree } from "@/tree/types";
import { formatYears } from "@/tree/years";
import { isPhone, isTabletOrPhone, PHONE_PANEL_SHARE } from "../screen";
import { useTheme } from "../theme";
import { CanvasActionsContext, type CanvasActions } from "./canvas-actions";
import type { CanvasFocus, CapturePicture } from "./FamilyCanvas";
import { focusViewport, readableViewport, revealViewport } from "./framing";
import { GENDER_COLORS, PersonPhoto } from "./PersonPhoto";
import { sheetPicture } from "./sheet-picture";
import { HEART } from "./UnionNode";

// Colours that read on the day and night canvas alike (and in the picture, always in day colours).
const GREY = "#a1a1aa"; // zinc-400
const LIT = "#f59e0b"; // amber-500

/** Who is lit up (the chosen person's relatives) while everyone else fades; null when nobody is chosen. */
const LitContext = createContext<Set<string> | null>(null);

const nodeWidth = (size: number) => Math.max(size, LABEL_WIDTH);

type PersonNodeType = Node<{ entry: NetworkPerson }, "person">;
type HeartNodeType = Node<{ heart: NetworkHeart; label: string }, "heart">;
type LineType = Edge<{ x1: number; y1: number; x2: number; y2: number; kind: "partner" | "child"; divorced: boolean; lit: boolean; faded: boolean }, "line">;

/** Invisible connection points: the lines are drawn from the layout's centres, but React Flow needs them. */
function Handles() {
  return (
    <>
      <Handle type="source" position={Position.Top} isConnectable={false} className="!opacity-0" />
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
    </>
  );
}

/** A person: their round photo or initials, sized by how many relations they have, and their name. */
function PersonCircle({ data }: NodeProps<PersonNodeType>) {
  const { person, size } = data.entry;
  const { onPerson, selectedId } = useContext(CanvasActionsContext);
  const lit = useContext(LitContext);
  const years = formatYears(person.birthYear, person.deathYear);
  const chosen = selectedId === person.id;
  return (
    <div
      data-testid="network-person"
      data-person-id={person.id}
      className={`relative flex flex-col items-center text-center transition-opacity ${lit && !lit.has(person.id) ? "opacity-25" : ""}`}
      style={{ width: nodeWidth(size), height: size + 2 * LABEL_HEIGHT }}
    >
      {onPerson && (
        <button
          type="button"
          aria-label={years ? `${person.name}, ${years}` : person.name}
          aria-pressed={chosen}
          onClick={() => onPerson(person.id)}
          className="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-amber-500"
        />
      )}
      <div className={`rounded-full ${chosen ? "ring-4 ring-amber-400" : lit?.has(person.id) ? "ring-2 ring-amber-400" : ""}`}>
        <PersonPhoto person={person} size={size} />
      </div>
      <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-5 tracking-tight text-zinc-900 dark:text-zinc-100" style={{ maxWidth: LABEL_WIDTH }}>
        {person.name}
      </div>
      <Handles />
    </div>
  );
}

/** A couple's heart on the line between them (broken when divorced); it opens the couple panel. */
function HeartNode({ id, data }: NodeProps<HeartNodeType>) {
  const { onCouple, selectedId } = useContext(CanvasActionsContext);
  const lit = useContext(LitContext);
  const { divorced } = data.heart;
  return (
    <div
      className={`relative rounded-full transition-opacity ${selectedId === id ? "ring-2 ring-amber-400" : ""} ${lit && !lit.has(id) ? "opacity-25" : ""}`}
      style={{ width: HEART_SIZE, height: HEART_SIZE }}
    >
      {onCouple && (
        <button
          type="button"
          aria-label={`${data.label}, ${divorced ? "divorced" : "married"}`}
          aria-pressed={selectedId === id}
          onClick={() => onCouple(id)}
          className="absolute inset-0 z-10 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-amber-500"
        />
      )}
      <svg width={HEART_SIZE} height={HEART_SIZE} viewBox="0 0 24 24" aria-hidden>
        <path d={HEART} fill={divorced ? GREY : "#fb7185"} />
        {divorced && <polyline points="12,6 10,10 13.5,13 11,17 12,21" fill="none" stroke="white" strokeWidth={1.6} />}
      </svg>
      <Handles />
    </div>
  );
}

/** A straight line between two centres, stopped at the circles' edges: a couple's, or an arrow to a child. */
function Line({ data, markerEnd }: EdgeProps<LineType>) {
  const { x1, y1, x2, y2, kind, divorced, lit, faded } = data!;
  return (
    <path
      d={`M ${x1},${y1} L ${x2},${y2}`}
      fill="none"
      stroke={lit ? LIT : kind === "partner" ? (divorced ? GREY : "#fb7185") : GREY}
      strokeWidth={lit ? 2.5 : kind === "partner" ? 2 : 1.25}
      strokeDasharray={divorced ? "6 5" : undefined}
      markerEnd={markerEnd}
      opacity={faded ? 0.2 : 1}
    />
  );
}

const nodeTypes = { person: PersonCircle, heart: HeartNode };
const edgeTypes = { line: Line };

// React Flow turns off pointer events on nodes it thinks are inert; a click handler keeps them on.
const keepNodesClickable = () => {};

/** The point `by` along the way from (x1, y1) to (x2, y2). */
function along(x1: number, y1: number, x2: number, y2: number, by: number) {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  return { x: x1 + ((x2 - x1) * by) / length, y: y1 + ((y2 - y1) * by) / length };
}

// Kept for each loaded group, so switching views and back doesn't arrange a big group again.
const graphs = new WeakMap<GroupTree, NetworkGraph>();
const layouts = new WeakMap<NetworkGraph, Promise<NetworkPositions>>();
function graphOf(tree: GroupTree) {
  if (!graphs.has(tree)) graphs.set(tree, networkGraph(tree));
  return graphs.get(tree)!;
}
function arrange(graph: NetworkGraph) {
  if (!layouts.has(graph)) layouts.set(graph, layoutNetwork(graph));
  return layouts.get(graph)!;
}

type Placed = { graph: NetworkGraph; positions: NetworkPositions };

function Network({ tree, rootPersonId, focus, captureRef }: { tree: GroupTree; rootPersonId: string; focus?: CanvasFocus | null; captureRef?: RefObject<CapturePicture | null> }) {
  const { selectedId } = useContext(CanvasActionsContext);
  const theme = useTheme() ?? "light";
  const latest = graphOf(tree);
  // What's drawn: the last arrangement, kept on screen while a changed group is arranged again.
  const [placed, setPlaced] = useState<Placed | null>(null);
  const graph = placed?.graph ?? latest;
  const positions = placed?.positions ?? null;
  const [slow, setSlow] = useState(false); // "Arranging…", only when the first arrangement takes a moment
  const { fitView, getNodes, getNode, getViewport, setViewport } = useReactFlow();
  const flow = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<CanvasFocus | null>(null);
  const framed = useRef(false);

  // Arranged in the browser only (never while the server draws the page), in slices.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => setSlow(true), 300);
    void arrange(latest).then((positions) => {
      clearTimeout(timer);
      if (!cancelled) setPlaced({ graph: latest, positions });
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [latest]);

  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () => sheetPicture(flow.current!, getNodes());
    return () => {
      captureRef.current = null;
    };
  }, [captureRef, getNodes]);

  const byId = useMemo(() => new Map(graph.persons.map((p) => [p.person.id, p])), [graph]);
  const lit = useMemo(() => (selectedId && byId.has(selectedId) ? networkRelatives(graph, selectedId) : null), [graph, byId, selectedId]);

  const nodes = useMemo<(PersonNodeType | HeartNodeType)[]>(() => {
    if (!positions) return [];
    return [
      ...graph.persons.map((entry): PersonNodeType => {
        const at = positions.get(entry.person.id)!;
        const width = nodeWidth(entry.size);
        return { id: entry.person.id, type: "person", position: { x: at.x - width / 2, y: at.y - entry.size / 2 }, width, height: entry.size + 2 * LABEL_HEIGHT, data: { entry } };
      }),
      ...graph.hearts.map((heart): HeartNodeType => {
        const at = positions.get(heart.id)!;
        const label = heart.partnerIds.map((id) => byId.get(id)?.person.name).join(" and ");
        return { id: heart.id, type: "heart", position: { x: at.x - HEART_SIZE / 2, y: at.y - HEART_SIZE / 2 }, width: HEART_SIZE, height: HEART_SIZE, data: { heart, label } };
      }),
    ];
  }, [graph, byId, positions]);

  const edges = useMemo<LineType[]>(() => {
    if (!positions) return [];
    const divorced = new Set(graph.hearts.filter((h) => h.divorced).map((h) => h.id));
    /** How far from `id`'s centre a line towards (dx, dy) stops: a person's circle or name, or a heart. */
    const reach = (id: string, dx: number, dy: number) => {
      const entry = byId.get(id);
      return entry ? personReach(entry, dx, dy) : HEART_SIZE / 2;
    };
    return graph.links.map((link): LineType => {
      const a = positions.get(link.source)!;
      const b = positions.get(link.target)!;
      const start = along(a.x, a.y, b.x, b.y, reach(link.source, b.x - a.x, b.y - a.y));
      const end = along(b.x, b.y, a.x, a.y, reach(link.target, a.x - b.x, a.y - b.y) + (link.kind === "child" ? 2 : 0));
      const on = lit?.links.has(link.id) ?? false;
      return {
        id: link.id,
        type: "line",
        source: link.source,
        target: link.target,
        markerEnd: link.kind === "child" ? { type: MarkerType.ArrowClosed, color: on ? LIT : GREY, width: 16, height: 16 } : undefined,
        data: { x1: start.x, y1: start.y, x2: end.x, y2: end.y, kind: link.kind, divorced: link.kind === "partner" && divorced.has(link.target), lit: on, faded: !!lit && !on },
      };
    });
  }, [graph, byId, positions, lit]);

  // Framing once arranged: a pending Find someone (or the person in a link) first; else computers see
  // the whole network, and phones and tablets start readable at the first sheet's root, like the Tree.
  useEffect(() => {
    if (!positions || framed.current || nodes.length === 0) return;
    framed.current = true;
    requestAnimationFrame(() => {
      if (!flow.current) return;
      const screen = flow.current.getBoundingClientRect();
      const waiting = pendingFocus.current && getNode(pendingFocus.current.personId);
      pendingFocus.current = null;
      if (waiting) {
        const card = { ...waiting.position, width: waiting.width ?? 0, height: waiting.height ?? 0 };
        return void setViewport(focusViewport(card, getViewport(), screen, isPhone() ? PHONE_PANEL_SHARE : 0));
      }
      if (!isTabletOrPhone()) return void fitView({ padding: 0.06 });
      const root = positions.get(rootPersonId);
      const framing = root && readableViewport(getNodesBounds(nodes), { x: root.x - CARD_WIDTH / 2, y: root.y - CARD_HEIGHT / 2 }, screen);
      if (framing) void setViewport(framing);
      else void fitView({ padding: 0.06 });
    });
  }, [positions, nodes, rootPersonId, fitView, getNode, getViewport, setViewport]);

  // Phones and tablets: bring the chosen circle (or heart) into view, above a phone's panel.
  useEffect(() => {
    if (!selectedId || !flow.current || !isTabletOrPhone()) return;
    const node = getNode(selectedId);
    if (!node) return;
    const card = { ...node.position, width: node.width ?? 0, height: node.height ?? 0 };
    const next = revealViewport(card, getViewport(), flow.current.getBoundingClientRect(), isPhone() ? undefined : 0);
    if (next) void setViewport(next, { duration: 250 });
  }, [selectedId, getNode, getViewport, setViewport]);

  // Find someone: centre the chosen circle, readable; kept until the network is arranged.
  useEffect(() => {
    if (!focus || !flow.current) return;
    const node = getNode(focus.personId);
    if (!node || !framed.current) return void (pendingFocus.current = focus);
    const card = { ...node.position, width: node.width ?? 0, height: node.height ?? 0 };
    void setViewport(focusViewport(card, getViewport(), flow.current.getBoundingClientRect(), isPhone() ? PHONE_PANEL_SHARE : 0), { duration: 300 });
  }, [focus, getNode, getViewport, setViewport]);

  return (
    <LitContext value={lit?.nodes ?? null}>
      <ReactFlow
        ref={flow}
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
        <MiniMap
          className="hidden lg:block"
          pannable
          zoomable
          nodeColor={(n) => (n.type === "person" ? GENDER_COLORS[(n as PersonNodeType).data.entry.person.gender].ring : "#fb7185")}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {!positions && slow && (
        <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          Arranging {graph.persons.length.toLocaleString("en")} people…
        </p>
      )}
      <Key />
    </LitContext>
  );
}

/** What the lines and circles mean (computers only; not in the picture). */
function Key() {
  const row = "flex items-center gap-2";
  return (
    <div aria-label="Key" role="group" className="absolute left-3 top-3 z-10 hidden flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white/90 p-3 text-xs text-zinc-600 shadow-sm lg:flex dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-400">
      <span className={row}>
        <svg width="28" height="12" aria-hidden>
          <line x1="0" y1="6" x2="28" y2="6" stroke="#fb7185" strokeWidth="2" />
          <path d={HEART} fill="#fb7185" transform="translate(8,0) scale(0.5)" />
        </svg>
        Couple (dashed: divorced)
      </span>
      <span className={row}>
        <svg width="28" height="12" aria-hidden>
          <line x1="0" y1="6" x2="22" y2="6" stroke={GREY} strokeWidth="1.5" />
          <path d="M22,2 L28,6 L22,10 z" fill={GREY} />
        </svg>
        Parent → child
      </span>
      <span className={row}>
        <svg width="28" height="16" aria-hidden>
          <circle cx="6" cy="8" r="4" fill="none" stroke={GENDER_COLORS.male.ring} strokeWidth="2" />
          <circle cx="19" cy="8" r="7" fill="none" stroke={GENDER_COLORS.female.ring} strokeWidth="2" />
        </svg>
        Bigger circle: more relations
      </span>
      <span className={row}>
        <svg width="28" height="12" aria-hidden>
          <line x1="0" y1="6" x2="28" y2="6" stroke={LIT} strokeWidth="2.5" />
        </svg>
        The chosen person&apos;s relations
      </span>
    </div>
  );
}

/**
 * ★ Everyone's Network (part 3 of an owner request after the final check): everyone and every relation
 * on one pan-and-zoom canvas, arranged by `layoutNetwork`. Like the Tree's canvas: `actions` make it
 * clickable, `focus` centres someone, `captureRef` makes the picture. `rootPersonId` is where phones and
 * tablets start.
 */
export function NetworkCanvas({
  tree,
  rootPersonId,
  focus,
  actions,
  captureRef,
}: {
  tree: GroupTree;
  rootPersonId: string;
  focus?: CanvasFocus | null;
  actions?: CanvasActions;
  captureRef?: RefObject<CapturePicture | null>;
}) {
  return (
    <ReactFlowProvider>
      <CanvasActionsContext value={actions ?? {}}>
        <Network tree={tree} rootPersonId={rootPersonId} focus={focus} captureRef={captureRef} />
      </CanvasActionsContext>
    </ReactFlowProvider>
  );
}
