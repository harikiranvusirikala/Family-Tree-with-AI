import { elkEngine } from "./elk";
import type { LayoutEngine } from "./types";

export * from "./types";

/**
 * The layout engine used everywhere. ELK.js won the step 2 comparison against relatives-tree,
 * which can only draw the root's own relatives (it dropped the in-law parents).
 * Swap engines here; everything else depends only on the LayoutEngine interface.
 */
export const layoutEngine: LayoutEngine = elkEngine;
