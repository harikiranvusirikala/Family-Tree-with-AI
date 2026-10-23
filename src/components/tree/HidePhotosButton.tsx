"use client";

import { outlineIconButton } from "@/components/ui/button";
import { LineIcon } from "@/components/ui/icons";

/**
 * The eye button at the end of the sheet tabs: hides every photo, so the cards, the panel and a picture
 * of the sheet show initials, for sharing without faces (an owner request after step 11). Pressed
 * while photos are hidden, when the eye gets a line through it.
 *
 * The same square, bordered button everywhere (the production look, the owner's choice): beside Export
 * on computers, just before the sheet menu (⋯) below 1024 px, 44 px on touch screens.
 */
export function HidePhotosButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label="Hide photos"
      aria-pressed={hidden}
      title={hidden ? "Photos are hidden: show them" : "Hide photos, showing initials"}
      onClick={onToggle}
      className={outlineIconButton}
    >
      <LineIcon name={hidden ? "eyeOff" : "eye"} className="size-[18px] pointer-coarse:size-5" />
    </button>
  );
}
