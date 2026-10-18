"use client";

import { useContext, useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CARD_HEIGHT, CARD_WIDTH, HEART_GAP, ROW_GAP, layoutEngine } from "@/tree/layout";
import type { SheetView } from "@/tree/types";
import { CanvasActionsContext, type CanvasActions } from "./canvas-actions";
import { GENDER_COLORS, PersonNode, type PersonNodeType } from "./PersonNode";
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

function Canvas({ view }: { view: SheetView }) {
  const { onPerson, onCouple } = useContext(CanvasActionsContext);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<ForkEdgeType[]>([]);
  const { fitView } = useReactFlow();

  // Lay the sheet out again whenever its people change: the "auto adjust" requirement.
  useEffect(() => {
    let cancelled = false;
    layoutEngine.layout(view).then((result) => {
      if (cancelled) return;
      const personById = new Map(view.persons.map((p) => [p.id, p]));
      const unionById = new Map(view.unions.map((u) => [u.id, u]));
      setNodes([
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
      ]);
      setEdges(
        result.links
          .filter((l) => l.kind === "child")
          .map((l): ForkEdgeType => ({ id: `${l.from}->${l.to}`, source: l.from, target: l.to, type: "fork" })),
      );
      requestAnimationFrame(() => fitView({ padding: 0.08 }));
    });
    return () => {
      cancelled = true;
    };
  }, [view, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onNodeClick={onPerson || onCouple ? keepNodesClickable : undefined}
      minZoom={0.1}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} gap={24} color="#e4e4e7" />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => (n.type === "person" ? GENDER_COLORS[(n as PersonNodeType).data.person.gender].ring : "transparent")}
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

/** Pan/zoom canvas for one sheet. Layout runs in the browser (ARCHITECTURE.md §7). */
export function FamilyCanvas({ view, actions }: { view: SheetView; actions?: CanvasActions }) {
  return (
    <ReactFlowProvider>
      <CanvasActionsContext value={actions ?? {}}>
        <Canvas view={view} />
      </CanvasActionsContext>
    </ReactFlowProvider>
  );
}
