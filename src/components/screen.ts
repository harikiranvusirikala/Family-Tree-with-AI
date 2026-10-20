// Screen sizes, for the few things CSS can't do (phones and tablets, an owner request after the final
// check). They follow Tailwind's breakpoints: phones are below `md` (48rem, 768 px), and tablets are
// below `lg` (1024 px), where the sheet's tools move into a menu.

export const PHONE_QUERY = "(width < 48rem)";
export const TABLET_OR_PHONE_QUERY = "(width < 64rem)";

// In the browser only (effects and event handlers): server rendering doesn't know the screen.
export const isPhone = () => window.matchMedia(PHONE_QUERY).matches;
export const isTabletOrPhone = () => window.matchMedia(TABLET_OR_PHONE_QUERY).matches;

/** The share of the tree that a person's or couple's panel may cover on a phone: the bottom half or so. */
export const PHONE_PANEL_SHARE = 0.55;
