"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// The app's drop-down menus (the production look, an owner request, 2026-10-23): the account menu,
// the group switcher and the theme. The WAI-ARIA menu button: the first (or checked) item takes focus
// when it opens, arrows, Home and End move, Escape closes and returns to the button, Tab closes.
// A tap anywhere else closes it: pointerdown, because React Flow stops the mouse events browsers
// make up after a touch. A page Next.js keeps for Back comes back with its menus closed.

const ITEMS = '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled])';

export const menuItem =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-700 outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 focus-visible:text-zinc-900 disabled:opacity-60 pointer-coarse:min-h-11 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:bg-zinc-800 dark:focus-visible:text-zinc-100";

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{children}</div>;
}

export function MenuSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-zinc-200 dark:bg-zinc-800" />;
}

export function Menu(props: {
  /** The menu's name, for screen readers. */
  label: string;
  /** What the button shows; give it `buttonLabel` when that isn't text. */
  button: ReactNode;
  buttonLabel?: string;
  buttonClassName: string;
  buttonTitle?: string;
  disabled?: boolean;
  align?: "start" | "end";
  menuClassName?: string;
  /** The items; `close` returns focus to the button. */
  children: (close: () => void) => ReactNode;
}) {
  const { label, button, buttonLabel, buttonClassName, buttonTitle, disabled, align = "end", menuClassName = "w-60", children } = props;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => () => setOpen(false), []); // its page hidden (React's Activity)

  // Found by id rather than a ref: `close` is handed to the items while they render.
  const close = () => {
    setOpen(false);
    document.getElementById(`${id}-button`)?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    (items.find((item) => item.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const items = [...(panel.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[event.key];
    if (to === undefined || !items.length) return;
    event.preventDefault();
    items[(to + items.length) % items.length].focus();
  }

  return (
    <div ref={root} className="relative min-w-0">
      <button
        id={`${id}-button`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={buttonLabel}
        title={buttonTitle}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`absolute top-full z-50 mt-2 max-w-[calc(100vw-1.5rem)] animate-menu-in rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl shadow-zinc-900/10 motion-reduce:animate-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-black/50 ${align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${menuClassName}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
