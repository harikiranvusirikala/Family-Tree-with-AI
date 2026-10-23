"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { UploadTicket } from "@/server/cloudinary";
import { setPhotoOps } from "@/tree/edits";
import type { Person } from "@/tree/types";
import type { PanelProps } from "./PersonPanel";
import { button } from "../../ui/button";
import { LineIcon } from "../../ui/icons";
import { PHOTO_ACCEPT, photoFileProblem, uploadPhoto } from "./upload-photo";

/** Add, Change and Remove photo: quiet links under the person's name. */
const photoLink =
  "inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-zinc-600 outline-none hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500/70 disabled:opacity-60 pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:text-zinc-100";

/** Asks the server for a signed upload into the group's folder (signPhotoUploadAction). */
export type SignPhotoUpload = () => Promise<{ ticket: UploadTicket; error?: undefined } | { error: string }>;

/**
 * F8: Add, Change and Remove photo, in the person panel (Maintain and up). The file goes straight from
 * the browser to Cloudinary; then the photo is saved on the person, and a replaced one is deleted.
 */
export function PhotoControls({
  person,
  signUpload,
  pending,
  run,
  onError,
}: Pick<PanelProps, "pending" | "run"> & { person: Person; signUpload: SignPhotoUpload; onError: (message: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busy = pending || uploading;

  async function upload(file: File) {
    const problem = photoFileProblem(file);
    if (problem) return onError(problem);
    onError(null);
    setUploading(true);
    try {
      const signed = await signUpload();
      if (signed.error !== undefined) return onError(signed.error);
      const uploaded = await uploadPhoto(signed.ticket, file);
      if ("error" in uploaded) return onError(uploaded.error);
      await run(setPhotoOps(person.id, uploaded.photoId));
    } finally {
      setUploading(false);
    }
  }

  function chosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still counts
    if (file) void upload(file);
  }

  async function remove() {
    onError(null);
    await run(setPhotoOps(person.id, null));
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div
        role="group"
        aria-label="Remove photo"
        className="flex flex-col gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
      >
        <p>Remove {person.name}&apos;s photo? It will be deleted, so this can&apos;t be undone.</p>
        <div className="flex gap-2">
          <button type="button" onClick={remove} disabled={busy} className={button("danger", "sm")}>
            Remove
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={button("ghost", "sm")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <input ref={input} type="file" accept={PHOTO_ACCEPT} onChange={chosen} hidden />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className={photoLink}>
        <LineIcon name="camera" className="size-4 shrink-0" />
        {person.photoId ? "Change photo" : "Add photo"}
      </button>
      {person.photoId && (
        <button type="button" onClick={() => setConfirming(true)} disabled={busy} className={photoLink}>
          Remove photo
        </button>
      )}
      {uploading && (
        <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
          Uploading photo…
        </p>
      )}
    </div>
  );
}
