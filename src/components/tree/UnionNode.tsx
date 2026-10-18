"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { HEART_GAP } from "@/tree/layout";

export type UnionNodeType = Node<{ couple: boolean; divorced: boolean }, "union">;

export const UNION_HEIGHT = 24;
const HEART = "M12 21s-7.5-4.6-9.6-9.2C1 8.6 2.9 5 6.4 5c2.1 0 3.6 1.2 4.6 2.7h2C14 6.2 15.5 5 17.6 5 21.1 5 23 8.6 21.6 11.8 19.5 16.4 12 21 12 21z";

/** "— ♥ —" between partners (a broken heart if divorced). A single parent's node is invisible. */
export function UnionNode({ data }: NodeProps<UnionNodeType>) {
  return (
    <div style={{ width: HEART_GAP, height: UNION_HEIGHT }} className="relative">
      {data.couple && (
        <svg width={HEART_GAP} height={UNION_HEIGHT} viewBox={`0 0 ${HEART_GAP} ${UNION_HEIGHT}`} aria-hidden>
          <line x1={2} y1={12} x2={14} y2={12} stroke="#a1a1aa" strokeWidth={1.5} />
          <line x1={HEART_GAP - 14} y1={12} x2={HEART_GAP - 2} y2={12} stroke="#a1a1aa" strokeWidth={1.5} />
          <g transform={`translate(${HEART_GAP / 2 - 12}, 0)`}>
            <path d={HEART} fill={data.divorced ? "#a1a1aa" : "#fb7185"} />
            {data.divorced && (
              <polyline points="12,6 10,10 13.5,13 11,17 12,21" fill="none" stroke="white" strokeWidth={1.6} />
            )}
          </g>
        </svg>
      )}
      <span className="sr-only">{data.divorced ? "divorced" : data.couple ? "married" : "single parent"}</span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!opacity-0" />
    </div>
  );
}
