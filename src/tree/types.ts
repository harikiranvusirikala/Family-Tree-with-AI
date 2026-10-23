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
  /** Where they are in their photo, when it shows several people (an owner request); only with a photo. */
  photoCrop?: PhotoCrop;
}

/**
 * A rectangle around a person in their photo, as fractions (0–1) of its width and height, so it fits
 * the photo at any size. The card's face crop is looked for only inside it.
 */
export interface PhotoCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A couple (the heart), or a single parent when there is one partner. */
export interface Union {
  id: string;
  partnerIds: [string] | [string, string];
  status: "married" | "divorced";
  /** When they married (an owner request after the final check): only couples of two, the day and month only with the year. */
  marriageYear?: number;
  marriageMonth?: number;
  marriageDay?: number;
  childIds: string[];
}

export interface Sheet {
  rootPersonId: string;
  extraPersonIds: string[];
  /**
   * One of the root's couples whose children (and their families) this sheet leaves out, because
   * another sheet shows them: a mother's own sheet shows her side of the family, not her children
   * with the father (an owner request after step 11). In turn, sheets that reach the root through
   * that couple's children stop at the root: her parents and cousins are on her sheet (§6 step 1).
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
