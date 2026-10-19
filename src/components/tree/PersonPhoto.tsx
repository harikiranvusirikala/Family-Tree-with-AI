"use client";

import { useContext, useState } from "react";
import type { Person } from "@/tree/types";
import { initials } from "../initials";
import { CloudNameContext, photoUrl } from "./photo";

// Features.txt: light blue border for male, light pink for female. The minimap needs the ring as a colour.
export const GENDER_COLORS = {
  male: { ring: "#93c5fd" },
  female: { ring: "#f9a8d4" },
} as const;

// The same rings day and night (blue-300, pink-300); the initials' circle darkens at night.
const CIRCLE = {
  male: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  female: "border-pink-300 bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-200",
} as const;

/**
 * The round photo in its blue or pink border, or the person's initials when there is no photo, photos
 * aren't set up, or the photo doesn't load.
 */
export function PersonPhoto({ person, size }: { person: Pick<Person, "name" | "gender" | "photoId">; size: number }) {
  const cloudName = useContext(CloudNameContext);
  const [failed, setFailed] = useState<string>(); // the photo that didn't load
  const src = cloudName && person.photoId && person.photoId !== failed ? photoUrl(cloudName, person.photoId) : undefined;
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-4 font-semibold ${CIRCLE[person.gender]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.29) }}
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
