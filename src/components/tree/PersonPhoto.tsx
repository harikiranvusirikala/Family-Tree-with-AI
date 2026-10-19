"use client";

import { useContext, useState } from "react";
import type { Person } from "@/tree/types";
import { initials } from "../initials";
import { CloudNameContext, photoUrl } from "./photo";

// Features.txt: light blue border for male, light pink for female.
export const GENDER_COLORS = {
  male: { ring: "#93c5fd", fill: "#eff6ff", text: "#1d4ed8" },
  female: { ring: "#f9a8d4", fill: "#fdf2f8", text: "#be185d" },
} as const;

/**
 * The round photo in its blue or pink border, or the person's initials when there is no photo, photos
 * aren't set up, or the photo doesn't load.
 */
export function PersonPhoto({ person, size }: { person: Pick<Person, "name" | "gender" | "photoId">; size: number }) {
  const cloudName = useContext(CloudNameContext);
  const [failed, setFailed] = useState<string>(); // the photo that didn't load
  const color = GENDER_COLORS[person.gender];
  const src = cloudName && person.photoId && person.photoId !== failed ? photoUrl(cloudName, person.photoId) : undefined;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold"
      style={{ width: size, height: size, border: `4px solid ${color.ring}`, background: color.fill, color: color.text, fontSize: Math.round(size * 0.29) }}
    >
      {src ? (
        // A plain <img>: Cloudinary already resizes, and next/image would use Vercel's image quota.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(person.photoId)} className="h-full w-full object-cover" />
      ) : (
        initials(person.name)
      )}
    </div>
  );
}
