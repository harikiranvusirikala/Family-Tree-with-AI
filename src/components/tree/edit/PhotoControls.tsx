"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { UploadTicket } from "@/server/cloudinary";
import { setPhotoOps } from "@/tree/edits";
import type { Person } from "@/tree/types";
import type { PanelProps } from "./PersonPanel";
import { PHOTO_ACCEPT, photoFileProblem, uploadPhoto } from "./upload-photo";

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
      <div role="group" aria-label="Remove photo" className="flex flex-col gap-2 rounded-md bg-red-50 p-3 text-sm dark:bg-red-950/50">
        <p>Remove {person.name}&apos;s photo? It will be deleted, so this can&apos;t be undone.</p>
        <div className="flex gap-2">
          <button type="button" onClick={remove} disabled={busy} className="rounded-md bg-red-700 px-3 py-1 font-medium text-white disabled:opacity-50">
            Remove
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-md px-3 py-1 hover:bg-red-100 dark:hover:bg-red-900/50">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      <input ref={input} type="file" accept={PHOTO_ACCEPT} onChange={chosen} hidden />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
        {person.photoId ? "Change photo" : "Add photo"}
      </button>
      {person.photoId && (
        <button type="button" onClick={() => setConfirming(true)} disabled={busy} className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Remove photo
        </button>
      )}
      {uploading && (
        <p role="status" className="px-2 text-zinc-500 dark:text-zinc-400">
          Uploading photo…
        </p>
      )}
    </div>
  );
}
