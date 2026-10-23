"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { UploadTicket } from "@/server/cloudinary";
import { setPhotoOps } from "@/tree/edits";
import { roundCrop } from "@/tree/photo-crop";
import type { Person, PhotoCrop } from "@/tree/types";
import { button } from "../../ui/button";
import { Dialog, DialogActions } from "../../ui/Dialog";
import { field, fieldLabel } from "../../ui/field";
import { LineIcon } from "../../ui/icons";
import { dangerMenuItem, Menu, menuItem, MenuSeparator } from "../../ui/Menu";
import { PersonPhoto } from "../PersonPhoto";
import { nameWithYears, type PanelProps } from "./PersonPanel";
import { PhotoCropper } from "./PhotoCropper";
import { TreePhotos, treePhotos } from "./TreePhotos";
import { PHOTO_ACCEPT, photoFileProblem, shrinkPhoto, uploadPhoto, uploadSizeProblem } from "./upload-photo";

/** Asks the server for a signed upload into the group's folder (signPhotoUploadAction). */
export type SignPhotoUpload = () => Promise<{ ticket: UploadTicket; error?: undefined } | { error: string }>;

/** What the dialog is showing. */
type Step =
  | null
  /**
   * "Which one is <name>?": the rectangle around `personId` in `photoId`. `saved`: the photo is already
   * theirs (uploaded, or Adjust photo); `upload`: just uploaded, so it then offers it for someone else.
   */
  | { kind: "mark"; personId: string; photoId: string; crop: PhotoCrop | null; saved: boolean; upload: boolean }
  /** After an upload: "Also use this photo for someone else?" */
  | { kind: "more"; photoId: string }
  /** "Use a photo from this tree" */
  | { kind: "pick" }
  | { kind: "remove" };

const photoButton =
  "group relative block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900";

/**
 * F8 in the person panel (Maintain and up), an owner request's design: the photo is a button. With a
 * mouse, hovering shows a camera on it; a badge on its edge (a camera, or "+" without a photo) is always
 * there, for touch screens. It opens a menu: Change, Adjust (where they are in the photo), Use a photo
 * from this tree, Remove. With no photo and no photos in the tree, there's only Upload, so the button
 * opens the file picker straight away. The file goes straight from the browser to Cloudinary, shrunk
 * first if it's large; then it's saved on the person, and "Which one is <name>?" opens, then offers it
 * for others in the photo. `people`: those it can be offered to (the current sheet's).
 */
export function PhotoMenu({
  person,
  tree,
  people,
  signUpload,
  pending,
  run,
  onError,
}: Pick<PanelProps, "tree" | "pending" | "run"> & { person: Person; people: Person[]; signUpload: SignPhotoUpload; onError: (message: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<Step>(null);
  const [someone, setSomeone] = useState("");
  const busy = pending || uploading;
  const nameOf = (id: string) => tree.persons.find((p) => p.id === id)?.name ?? "";
  const others = treePhotos(tree).filter((photo) => photo.photoId !== person.photoId);
  const usersOf = (photoId: string) => tree.persons.filter((p) => p.photoId === photoId);
  const close = () => setStep(null);

  async function upload(file: File) {
    const problem = photoFileProblem(file);
    if (problem) return onError(problem);
    onError(null);
    setUploading(true);
    try {
      const photo = await shrinkPhoto(file);
      const tooBig = uploadSizeProblem(photo);
      if (tooBig) return onError(tooBig);
      const signed = await signUpload();
      if (signed.error !== undefined) return onError(signed.error);
      const uploaded = await uploadPhoto(signed.ticket, photo);
      if ("error" in uploaded) return onError(uploaded.error);
      if (await run(setPhotoOps(person.id, uploaded.photoId))) {
        setStep({ kind: "mark", personId: person.id, photoId: uploaded.photoId, crop: null, saved: true, upload: true });
      }
    } finally {
      setUploading(false);
    }
  }

  function chosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still counts
    if (file) void upload(file);
  }

  /** Saves where they are in the photo (or the whole photo), when it changes anything. */
  async function mark(crop: PhotoCrop | null) {
    if (step?.kind !== "mark") return;
    const target = tree.persons.find((p) => p.id === step.personId);
    const rounded = crop && roundCrop(crop);
    const same = step.saved && target?.photoId === step.photoId && JSON.stringify(target.photoCrop ?? null) === JSON.stringify(rounded);
    if (!same && !(await run(setPhotoOps(step.personId, step.photoId, rounded)))) return;
    if (step.upload) {
      setSomeone("");
      setStep({ kind: "more", photoId: step.photoId });
    } else close();
  }

  async function remove() {
    onError(null);
    if (await run(setPhotoOps(person.id, null))) close();
  }

  const openPicker = () => input.current?.click();
  const photo = (
    <span className="relative block">
      <PersonPhoto person={person} size={64} />
      {/* With a mouse: a camera over the photo while hovering (or focused by the keyboard). */}
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center rounded-full bg-zinc-950/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-0"
      >
        <LineIcon name="camera" className="size-6" />
      </span>
      {uploading && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center rounded-full bg-zinc-950/50">
          <span className="size-6 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
        </span>
      )}
      {/* Always there, for touch screens, which have no hover. */}
      <span
        aria-hidden
        className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      >
        <LineIcon name={person.photoId ? "camera" : "plus"} className="size-3.5" />
      </span>
    </span>
  );

  const dialogTitle =
    step?.kind === "mark"
      ? `Which one is ${nameOf(step.personId)}?`
      : step?.kind === "more"
        ? "Also use this photo for someone else?"
        : step?.kind === "pick"
          ? "Use a photo from this tree"
          : "Remove photo?";
  const sharedWith = person.photoId ? usersOf(person.photoId).filter((p) => p.id !== person.id).length : 0;
  const offered = step?.kind === "more" ? people.filter((p) => p.photoId !== step.photoId) : [];

  return (
    <>
      <input ref={input} type="file" accept={PHOTO_ACCEPT} onChange={chosen} hidden />
      {!person.photoId && others.length === 0 ? (
        <button type="button" aria-label={`Add a photo of ${person.name}`} onClick={openPicker} disabled={busy} className={photoButton}>
          {photo}
        </button>
      ) : (
        <Menu
          label="Photo options"
          button={photo}
          buttonLabel={`Photo options for ${person.name}`}
          buttonClassName={photoButton}
          disabled={busy}
          align="start"
          menuClassName="w-64"
        >
          {(closeMenu) => {
            const item = (label: string, icon: Parameters<typeof LineIcon>[0]["name"], onClick: () => void, className = menuItem) => (
              <button
                type="button"
                role="menuitem"
                className={className}
                onClick={() => {
                  closeMenu();
                  onClick();
                }}
              >
                <LineIcon name={icon} className="size-4 shrink-0" />
                {label}
              </button>
            );
            return person.photoId ? (
              <>
                {item("Change photo…", "upload", openPicker)}
                {item("Adjust photo…", "crop", () =>
                  setStep({ kind: "mark", personId: person.id, photoId: person.photoId!, crop: person.photoCrop ?? null, saved: true, upload: false }),
                )}
                {others.length > 0 && item("Use a photo from this tree…", "photo", () => setStep({ kind: "pick" }))}
                <MenuSeparator />
                {item("Remove photo…", "trash", () => setStep({ kind: "remove" }), dangerMenuItem)}
              </>
            ) : (
              <>
                {item("Upload a photo…", "upload", openPicker)}
                {item("Use a photo from this tree…", "photo", () => setStep({ kind: "pick" }))}
              </>
            );
          }}
        </Menu>
      )}
      <p role="status" className="sr-only">
        {uploading ? "Uploading photo…" : ""}
      </p>

      <Dialog
        open={step !== null}
        onClose={close}
        title={dialogTitle}
        wide={step?.kind === "mark" || step?.kind === "pick"}
        description={
          step?.kind === "mark"
            ? "Draw a rectangle around them: their face on the card is found inside it. Choose Whole photo if they're the only one in it."
            : step?.kind === "pick"
              ? `Choose a photo someone else has, then show where ${person.name} is in it.`
              : undefined
        }
      >
        {step?.kind === "mark" && (
          <div className="flex flex-col gap-5">
            <PhotoCropper photoId={step.photoId} name={nameOf(step.personId)} crop={step.crop} onChange={(crop) => setStep({ ...step, crop })} />
            <DialogActions>
              <button type="button" onClick={() => mark(null)} disabled={pending} className={button("secondary")}>
                Whole photo
              </button>
              <button type="button" onClick={() => mark(step.crop)} disabled={pending || !step.crop} className={button("primary")}>
                Save
              </button>
            </DialogActions>
          </div>
        )}

        {step?.kind === "more" && (
          <form
            aria-label="Also use this photo"
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (someone) setStep({ kind: "mark", personId: someone, photoId: step.photoId, crop: null, saved: false, upload: true });
            }}
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Saved for{" "}
              {usersOf(step.photoId)
                .map((p) => p.name)
                .join(", ")}
              . If others are in it, choose them one at a time.
            </p>
            {offered.length > 0 && (
              <label className={fieldLabel}>
                Someone else in the photo
                <select value={someone} onChange={(event) => setSomeone(event.target.value)} className={field}>
                  <option value="">Choose someone…</option>
                  {offered.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nameWithYears(p)}
                      {p.photoId ? " (replaces their photo)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <DialogActions>
              <button type="button" onClick={close} className={button("secondary")}>
                Done
              </button>
              {offered.length > 0 && (
                <button type="submit" disabled={!someone} className={button("primary")}>
                  Choose
                </button>
              )}
            </DialogActions>
          </form>
        )}

        {step?.kind === "pick" && (
          <TreePhotos
            photos={others}
            nameOf={nameOf}
            onPick={(photoId) => setStep({ kind: "mark", personId: person.id, photoId, crop: null, saved: false, upload: false })}
          />
        )}

        {step?.kind === "remove" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {sharedWith > 0
                ? `It comes off ${person.name}'s card, and stays for the ${sharedWith === 1 ? "other person who uses it" : `${sharedWith} others who use it`}.`
                : `${person.name}'s photo will be deleted, so this can't be undone.`}
            </p>
            <DialogActions>
              <button type="button" data-autofocus onClick={close} className={button("secondary")}>
                Cancel
              </button>
              <button type="button" onClick={remove} disabled={pending} className={button("danger")}>
                Remove
              </button>
            </DialogActions>
          </div>
        )}
      </Dialog>
    </>
  );
}
