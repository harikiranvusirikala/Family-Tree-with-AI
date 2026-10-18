"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CARD_HEIGHT, CARD_WIDTH, PHOTO_SIZE, PHOTO_TOP } from "@/tree/layout";
import { formatYears } from "@/tree/years";
import type { Person } from "@/tree/types";
import { initials } from "../initials";

export type PersonNodeType = Node<{ person: Person }, "person">;

// Features.txt: light blue border for male, light pink for female.
export const GENDER_COLORS = {
  male: { ring: "#93c5fd", fill: "#eff6ff", text: "#1d4ed8" },
  female: { ring: "#f9a8d4", fill: "#fdf2f8", text: "#be185d" },
} as const;

export function PersonNode({ data }: NodeProps<PersonNodeType>) {
  const { person } = data;
  const color = GENDER_COLORS[person.gender];
  const years = formatYears(person.birthYear, person.deathYear);
  return (
    <div
      data-testid="person-card"
      data-person-id={person.id}
      className="flex flex-col items-center text-center"
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
    >
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
