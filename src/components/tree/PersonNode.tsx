"use client";

import { useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CARD_HEIGHT, CARD_WIDTH, PHOTO_SIZE, PHOTO_TOP } from "@/tree/layout";
import { formatYears } from "@/tree/years";
import type { Person } from "@/tree/types";
import { initials } from "../initials";
import { CanvasActionsContext } from "./canvas-actions";

export type PersonNodeType = Node<{ person: Person }, "person">;

// Features.txt: light blue border for male, light pink for female.
export const GENDER_COLORS = {
  male: { ring: "#93c5fd", fill: "#eff6ff", text: "#1d4ed8" },
  female: { ring: "#f9a8d4", fill: "#fdf2f8", text: "#be185d" },
} as const;

export function PersonNode({ data }: NodeProps<PersonNodeType>) {
  const { person } = data;
  const { onPerson, selectedId } = useContext(CanvasActionsContext);
  const color = GENDER_COLORS[person.gender];
  const years = formatYears(person.birthYear, person.deathYear);
  return (
    <div
      data-testid="person-card"
      data-person-id={person.id}
      className={`relative flex flex-col items-center rounded-lg text-center ${selectedId === person.id ? "bg-amber-50 ring-2 ring-amber-400" : ""}`}
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
      <div
        className="flex items-center justify-center rounded-full text-2xl font-semibold"
        style={{
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          marginTop: PHOTO_TOP,
          border: `4px solid ${color.ring}`,
          background: color.fill,
          color: color.text,
        }}
      >
        {initials(person.name)}
      </div>
      <div className="mt-2 font-serif text-[15px] font-bold leading-tight text-zinc-900">{person.name}</div>
      {years && <div className="mt-0.5 text-xs text-zinc-500">{years}</div>}
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
    </div>
  );
}
