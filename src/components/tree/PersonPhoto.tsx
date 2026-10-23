"use client";

import { useContext, useState } from "react";
import type { Person } from "@/tree/types";
import { initials } from "../initials";
import { CloudNameContext, PhotosHiddenContext, photoUrl } from "./photo";

// FEATURES.md: light blue border for male, light pink for female. The minimap needs the ring as a colour.
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
 * aren't set up or are hidden, or the photo doesn't load. `lazy` (★ Everyone's List) loads the photo
 * only when it scrolls near the screen; not on the tree, whose picture needs every photo. `thin`: a
 * 2 px ring, for small circles in rows and lists. Hidden from screen readers: the name is always
 * beside it, and the initials would be read before it.
 */
export function PersonPhoto(props: { person: Pick<Person, "name" | "gender" | "photoId" | "photoCrop">; size: number; lazy?: boolean; thin?: boolean }) {
  const { person, size, lazy = false, thin = false } = props;
  const cloudName = useContext(CloudNameContext);
  const hidden = useContext(PhotosHiddenContext);
  const [failed, setFailed] = useState<string>(); // the photo that didn't load
  const src = cloudName && !hidden && person.photoId && person.photoId !== failed ? photoUrl(cloudName, person.photoId, person.photoCrop) : undefined;
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${thin ? "border-2" : "border-4"} ${CIRCLE[person.gender]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.29) }}
    >
      {src ? (
        // A plain <img>: Cloudinary already resizes, and next/image would use Vercel's image quota.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading={lazy ? "lazy" : undefined} onError={() => setFailed(person.photoId)} className="h-full w-full object-cover" />
      ) : (
        initials(person.name)
      )}
    </div>
  );
}
