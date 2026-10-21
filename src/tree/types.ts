// Pure tree types shared by the browser, the server and tests.
// Database records (ARCHITECTURE.md §5) add groupId, audit fields and deletedAt on top of these.

export type Gender = "male" | "female";

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  birthYear?: number;
  deathYear?: number; // absent = living
  /** A full date's day and month, only with its year (an owner request after the final check). */
  birthMonth?: number;
  birthDay?: number;
  deathMonth?: number;
  deathDay?: number;
  photoId?: string; // Cloudinary public ID
}

/** A couple (the heart), or a single parent when there is one partner. */
export interface Union {
  id: string;
  partnerIds: [string] | [string, string];
  status: "married" | "divorced";
  childIds: string[];
}

export interface Sheet {
  rootPersonId: string;
  extraPersonIds: string[];
  /**
   * One of the root's couples whose children (and their families) this sheet leaves out, because
   * another sheet shows them: a mother's own sheet shows her side of the family, not her children
   * with the father (an owner request after step 11).
   */
  hideChildrenOf?: string;
}

/** A saved sheet, as shown in the sheet tabs. */
export interface NamedSheet extends Sheet {
  id: string;
  title: string;
  pinned: boolean;
  order: number;
}

export interface FamilyData {
  persons: Person[];
  unions: Union[];
}

/** A group's people, couples and sheets, as loaded for drawing (F5). */
export interface GroupTree extends FamilyData {
  sheets: NamedSheet[];
}

/** Who is drawn on one sheet. Built by buildSheetView(). */
export interface SheetView {
  rootPersonId: string;
  persons: Person[];
  /** Only unions whose partners are all on the sheet; childIds limited to people on the sheet. */
  unions: Union[];
}
