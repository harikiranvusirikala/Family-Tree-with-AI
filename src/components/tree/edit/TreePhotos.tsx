"use client";

import { useContext } from "react";
import type { GroupTree } from "@/tree/types";
import { CloudNameContext, wholePhotoUrl } from "../photo";

/** One photo in the tree and who it's on. */
export interface TreePhoto {
  photoId: string;
  personIds: string[];
}

/** Every photo the tree's people use, once each, in the order of the people (deleted people's aren't in the tree). */
export function treePhotos(tree: GroupTree): TreePhoto[] {
  const byPhoto = new Map<string, string[]>();
  for (const p of tree.persons) if (p.photoId) byPhoto.set(p.photoId, [...(byPhoto.get(p.photoId) ?? []), p.id]);
  return [...byPhoto].map(([photoId, personIds]) => ({ photoId, personIds }));
}

/** Twice the tile's size, for sharp screens. */
const TILE_PIXELS = 320;

/** "Use a photo from this tree" (an owner request): the whole photos, as tiles named by who they're on. */
export function TreePhotos({ photos, nameOf, onPick }: { photos: TreePhoto[]; nameOf: (id: string) => string; onPick: (photoId: string) => void }) {
  const cloudName = useContext(CloudNameContext);
  if (!cloudName) return null;
  return (
    <ul aria-label="Photos in this tree" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map(({ photoId, personIds }) => {
        const names = personIds.map(nameOf).join(", ");
        return (
          <li key={photoId}>
            <button
              type="button"
              aria-label={`Photo of ${names}`}
              onClick={() => onPick(photoId)}
              className="flex w-full flex-col gap-1.5 rounded-xl border border-zinc-200 p-1.5 text-left outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wholePhotoUrl(cloudName, photoId, TILE_PIXELS)} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-zinc-100 object-cover dark:bg-zinc-800" />
              <span className="line-clamp-2 px-1 text-xs text-zinc-600 dark:text-zinc-400">{names}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
