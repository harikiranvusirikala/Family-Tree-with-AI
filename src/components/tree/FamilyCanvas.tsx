"use client";

import { useContext, useEffect, useRef, useState, type RefObject } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CARD_HEIGHT, CARD_WIDTH, HEART_GAP, ROW_GAP, layoutEngine } from "@/tree/layout";
import type { SheetView } from "@/tree/types";
import { isPhone, isTabletOrPhone } from "../screen";
import { useTheme } from "../theme";
import { CanvasActionsContext, type CanvasActions } from "./canvas-actions";
import { PersonNode, type PersonNodeType } from "./PersonNode";
import { GENDER_COLORS } from "./PersonPhoto";
import { readableViewport, revealViewport } from "./framing";
import { sheetPicture } from "./sheet-picture";

/** Set by the canvas: captures the whole sheet as a PNG data URL (Export, picture). */
export type CapturePicture = () => Promise<string>;
import { UNION_HEIGHT, UnionNode, type UnionNodeType } from "./UnionNode";

type ForkEdgeType = Edge<Record<string, never>, "fork">;

/** Heart → down to the gap above the children's row → across → down to the child (like the sample). */
function ForkEdge({ id, sourceX, sourceY, targetX, targetY }: EdgeProps<ForkEdgeType>) {
  const midY = targetY - ROW_GAP / 2;
  return <BaseEdge id={id} path={`M ${sourceX},${sourceY} V ${midY} H ${targetX} V ${targetY}`} style={{ stroke: "#71717a" }} />;
}

const nodeTypes = { person: PersonNode, union: UnionNode };
const edgeTypes = { fork: ForkEdge };

type FlowNode = PersonNodeType | UnionNodeType;

// React Flow turns off pointer events on nodes it thinks are inert (not draggable, selectable or
// clickable). Giving it a click handler keeps them on, so the cards' own buttons get the clicks.
const keepNodesClickable = () => {};

function Canvas({ view, sheetId, captureRef }: { view: SheetView; sheetId?: string; captureRef?: RefObject<CapturePicture | null> }) {
  const { onPerson, onCouple, selectedId } = useContext(CanvasActionsContext);
  const theme = useTheme() ?? "light";
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<ForkEdgeType[]>([]);
  const { fitView, getNodes, getNode, getViewport, setViewport } = useReactFlow();
  const flow = useRef<HTMLDivElement>(null);
  /** The sheet last framed (null for the dev pages, which have no sheet id; undefined before the first). */
  const framed = useRef<string | null>(undefined);

  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () => sheetPicture(flow.current!, getNodes());
    return () => {
      captureRef.current = null;
    };
  }, [captureRef, getNodes]);

  // Lay the sheet out again whenever its people change: the "auto adjust" requirement.
  useEffect(() => {
    let cancelled = false;
    layoutEngine.layout(view).then((result) => {
      if (cancelled) return;
      const personById = new Map(view.persons.map((p) => [p.id, p]));
      const unionById = new Map(view.unions.map((u) => [u.id, u]));
      const built: FlowNode[] = [
        ...result.persons.map(
          (p): PersonNodeType => ({
            id: p.id,
            type: "person",
            position: { x: p.x, y: p.y },
            // Fixed sizes: the nodes are controlled, so React Flow (and the minimap) can't measure them.
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            data: { person: personById.get(p.id)! },
          }),
        ),
        ...result.unions.map((u): UnionNodeType => {
          const union = unionById.get(u.id)!;
          return {
            id: u.id,
            type: "union",
            position: { x: u.x - HEART_GAP / 2, y: u.y - UNION_HEIGHT / 2 },
            width: HEART_GAP,
            height: UNION_HEIGHT,
            data: {
              couple: union.partnerIds.length === 2,
              divorced: union.status === "divorced",
              label: union.partnerIds.map((id) => personById.get(id)?.name).join(" and "),
            },
          };
        }),
      ];
      setNodes(built);
      setEdges(
        result.links
          .filter((l) => l.kind === "child")
          .map((l): ForkEdgeType => ({ id: `${l.from}->${l.to}`, source: l.from, target: l.to, type: "fork" })),
      );
      const newSheet = framed.current !== (sheetId ?? null);
      framed.current = sheetId ?? null;
      requestAnimationFrame(() => {
        if (!isTabletOrPhone()) return void fitView({ padding: 0.08 });
        // Phones and tablets: a new sheet opens zoomed in at its root. After a change to the same sheet
        // the view stays where the person left it, rather than jumping back to the root.
        if (!newSheet || !flow.current) return;
        const root = result.persons.find((p) => p.id === view.rootPersonId);
        const framing = root && readableViewport(getNodesBounds(built), root, flow.current.getBoundingClientRect());
        if (framing) void setViewport(framing);
        else void fitView({ padding: 0.08 });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [view, sheetId, fitView, setViewport]);

  // Phones and tablets: bring the selected card (or heart) into view, above a phone's panel, or within
  // a tablet's tree, which the panel beside it has just made narrower.
  useEffect(() => {
    if (!selectedId || !flow.current || !isTabletOrPhone()) return;
    const node = getNode(selectedId);
    if (!node) return; // not on this sheet, or not laid out yet
    const card = { ...node.position, width: node.width ?? 0, height: node.height ?? 0 };
    const next = revealViewport(card, getViewport(), flow.current.getBoundingClientRect(), isPhone() ? undefined : 0);
    if (next) void setViewport(next, { duration: 250 });
  }, [selectedId, getNode, getViewport, setViewport]);

  return (
    <ReactFlow
      ref={flow}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onNodeClick={onPerson || onCouple ? keepNodesClickable : undefined}
      minZoom={0.1}
      // No fitView prop: the effect above frames each sheet. The prop's fit waits for the cards to be
      // measured, after that, and would undo a phone's zoomed-in first view.
      colorMode={theme} // React Flow's own night colours: canvas, controls and minimap
    >
      <Background variant={BackgroundVariant.Dots} gap={24} color={theme === "dark" ? "#3f3f46" : "#e4e4e7"} />
      <MiniMap
        className="hidden lg:block" // it would cover a good part of a phone's or tablet's tree
        pannable
        zoomable
        nodeColor={(n) => (n.type === "person" ? GENDER_COLORS[(n as PersonNodeType).data.person.gender].ring : "transparent")}
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

/**
 * Pan/zoom canvas for one sheet. Layout runs in the browser (ARCHITECTURE.md §7). `sheetId` tells a new
 * sheet from a change to the same one, which phones frame differently.
 */
export function FamilyCanvas({
  view,
  sheetId,
  actions,
  captureRef,
}: {
  view: SheetView;
  sheetId?: string;
  actions?: CanvasActions;
  captureRef?: RefObject<CapturePicture | null>;
}) {
  return (
    <ReactFlowProvider>
      <CanvasActionsContext value={actions ?? {}}>
        <Canvas view={view} sheetId={sheetId} captureRef={captureRef} />
      </CanvasActionsContext>
    </ReactFlowProvider>
  );
}
