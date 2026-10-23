"use client";

import { useId } from "react";

/**
 * Ask AI's sparkle in the blue-to-pink gradient (the production look: the gradient's only other use is
 * under the open tab). Each one has its own gradient id: a shared one would stop painting wherever the
 * first copy is hidden (Chrome doesn't paint a gradient defined inside display: none).
 */
export function GradientSparkle({ className = "size-4" }: { className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id={id} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7Z" fill={`url(#${id})`} />
      <path d="M18.5 15.5c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z" fill={`url(#${id})`} />
    </svg>
  );
}
