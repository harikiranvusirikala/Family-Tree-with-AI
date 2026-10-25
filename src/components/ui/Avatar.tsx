"use client";

import { useEffect, useRef, useState } from "react";
import { initials } from "../initials";

/**
 * An account's initials in a neutral ring (the production look): the account menu, members, requests.
 * With `photo` (the account's Google photo, `googlePhotoUrl`), the photo in the same ring, falling
 * back to the initials if it doesn't load. People in the tree have PersonPhoto instead, with
 * its blue and pink rings.
 */
export function Avatar({ name, photo, className = "size-8 text-[13px]" }: { name: string; photo?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = photo && failed !== photo;
  const img = useRef<HTMLImageElement>(null);
  // The photo is in the server's HTML, so it can fail before React listens for onError.
  useEffect(() => {
    if (photo && img.current?.complete && img.current.naturalWidth === 0) setFailed(photo);
  }, [photo]);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 font-semibold text-zinc-700 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 ${className}`}
    >
      {showPhoto ? (
        // A plain <img>: Google already sizes it, and next/image would use Vercel's image quota. No
        // referrer: Google's photo servers sometimes refuse requests that send one.
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={photo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(photo)} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
