"use client";

import { useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CARD_HEIGHT, CARD_WIDTH, PHOTO_SIZE, PHOTO_TOP } from "@/tree/layout";
import { formatYears } from "@/tree/years";
import type { Person } from "@/tree/types";
import { CanvasActionsContext } from "./canvas-actions";
import { PersonPhoto } from "./PersonPhoto";

export type PersonNodeType = Node<{ person: Person }, "person">;

export function PersonNode({ data }: NodeProps<PersonNodeType>) {
  const { person } = data;
  const { onPerson, selectedId } = useContext(CanvasActionsContext);
  const years = formatYears(person.birthYear, person.deathYear);
  return (
    <div
      data-testid="person-card"
      data-person-id={person.id}
      className={`relative flex flex-col items-center rounded-lg text-center ${selectedId === person.id ? "bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-950/60" : ""}`}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
    >
      {onPerson && (
        <button
          type="button"
          aria-label={years ? `${person.name}, ${years}` : person.name}
          aria-pressed={selectedId === person.id}
          onClick={() => onPerson(person.id)}
          className="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-amber-500"
        />
      )}
      <div style={{ marginTop: PHOTO_TOP }}>
        <PersonPhoto person={person} size={PHOTO_SIZE} />
      </div>
      <div className="mt-2 text-[15px] font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-100">{person.name}</div>
      {years && <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{years}</div>}
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
    </div>
  );
}
