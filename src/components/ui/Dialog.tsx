"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { iconButton } from "./button";
import { LineIcon } from "./icons";

// The app's dialogs (the production look, an owner request): the browser's own modal <dialog>, which
// makes the page behind inert, takes the focus and gives it back to the button that opened it. Escape,
// a click outside or Close end it; React keeps whether it's open.
//
// Next.js hides the page someone leaves instead of unmounting it (React's Activity, display: none),
// to show it again on Back. A modal left open in a hidden page would make the next one inert (found
// when an import opened its new group), so hiding closes it, and its page comes back with it closed.

const FIRST_FIELD = "[data-autofocus], input:not([type='hidden']):not([type='file']):not([disabled]), select, textarea";

export function Dialog(props: {
  open: boolean;
  onClose: () => void;
  /** Shown as its heading and naming it; with `bare` the content brings its own heading and Close. */
  title: string;
  description?: ReactNode;
  bare?: boolean;
  /** Wider, for previews (Import). */
  wide?: boolean;
  children: ReactNode;
}) {
  const { open, onClose, title, description, bare = false, wide = false, children } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    if (!element.open) element.showModal();
    // The browser focuses the first thing it can (Close); the first field is where people start.
    element.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
    return () => element.close(); // closed, unmounted, or its page hidden
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={bare ? undefined : titleId}
      aria-label={bare ? title : undefined}
      onCancel={(event) => {
        event.preventDefault(); // Escape: React closes it, so `open` stays the truth
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose(); // the backdrop, around the box
      }}
      className={`m-auto max-h-[min(90dvh,52rem)] w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl shadow-zinc-950/20 backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px] open:animate-dialog-in motion-reduce:open:animate-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-black/60 ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
    >
      {open && (
        <div className="p-5 sm:p-6">
          {!bare && (
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-pretty text-zinc-600 dark:text-zinc-400">{description}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className={`${iconButton} -mt-1 -mr-2`}>
                <LineIcon name="x" className="size-5" />
              </button>
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}

/** A dialog's foot: Cancel, then the main button on the right (on top, on phones). */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}

/** A button that opens a dialog; the dialog's content gets `close`. */
export function DialogButton(props: {
  button: ReactNode;
  buttonClassName: string;
  buttonLabel?: string;
  title: string;
  description?: ReactNode;
  bare?: boolean;
  wide?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const { button, buttonClassName, buttonLabel, children, ...dialog } = props;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useLayoutEffect(() => () => setOpen(false), []); // its page hidden: closed when it comes back
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={buttonLabel} onClick={() => setOpen(true)} className={buttonClassName}>
        {button}
      </button>
      <Dialog {...dialog} open={open} onClose={close}>
        {children(close)}
      </Dialog>
    </>
  );
}
