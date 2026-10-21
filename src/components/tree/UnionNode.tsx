"use client";

import { useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { HEART_GAP } from "@/tree/layout";
import { formatMarriage, type MarriageDate } from "@/tree/years";
import { CanvasActionsContext } from "./canvas-actions";

export type UnionNodeType = Node<{ couple: boolean; divorced: boolean; label: string; partnerIds: string[]; married: MarriageDate }, "union">;

export const UNION_HEIGHT = 24;
export const HEART = "M12 21s-7.5-4.6-9.6-9.2C1 8.6 2.9 5 6.4 5c2.1 0 3.6 1.2 4.6 2.7h2C14 6.2 15.5 5 17.6 5 21.1 5 23 8.6 21.6 11.8 19.5 16.4 12 21 12 21z";

/**
 * "— ♥ —" between partners (a broken heart if divorced), with the year they married above it: the full
 * date while the heart or either partner is selected (an owner request). A single parent's node is invisible.
 */
export function UnionNode({ id, data }: NodeProps<UnionNodeType>) {
  const { onCouple, selectedId } = useContext(CanvasActionsContext);
  const { marriageYear } = data.married;
  const full = selectedId !== undefined && (selectedId === id || data.partnerIds.includes(selectedId));
  return (
    <div style={{ width: HEART_GAP, height: UNION_HEIGHT }} className={`relative rounded ${selectedId === id ? "ring-2 ring-amber-400" : ""}`}>
      {data.couple && onCouple && (
        <button
          type="button"
          aria-label={`${data.label}, ${data.divorced ? "divorced" : "married"}`}
          aria-pressed={selectedId === id}
          onClick={() => onCouple(id)}
          className="absolute inset-0 z-10 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-amber-500"
        />
      )}
      {data.couple && marriageYear !== undefined && (
        <div data-testid="marriage-date" className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap text-xs leading-4 text-zinc-500 dark:text-zinc-400">
          {full ? formatMarriage(data.married) : marriageYear}
        </div>
      )}
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
