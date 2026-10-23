import { z } from "zod";
import { MIN_CROP } from "@/tree/photo-crop";

// ARCHITECTURE.md §10. Manual edits, confirmed AI proposals and imports all become these operations.

const id = z.string().regex(/^[a-f\d]{24}$/i, "Not a valid id");
const tempId = z.string().regex(/^new:[\w-]{1,64}$/, 'Temporary ids look like "new:1"');
/** An existing id, or a temporary id created earlier in the same batch. */
const ref = z.union([id, tempId]);
const name = z.string().trim().min(1, "Name is required").max(120);
export { name as personName, year, month, day };
const gender = z.enum(["male", "female"]);
const year = z.number().int("Enter a whole year").min(1000, "Enter a year from 1000 on").max(2200, "Enter a year up to 2200");
// A full date's month and day (an owner request after the final check); the planner checks the whole date.
const month = z.number().int("Choose a month").min(1, "Choose a month").max(12, "Choose a month");
const day = z.number().int("Enter a day from 1 to 31").min(1, "Enter a day from 1 to 31").max(31, "Enter a day from 1 to 31");
const unionStatus = z.enum(["married", "divorced"]);
const sheetTitle = z.string().trim().min(1, "Title is required").max(120);
/** A Cloudinary public ID in a group's folder (F8): groups/<group id>/<random part>. */
export const PHOTO_ID = /^groups\/[a-f\d]{24}\/[\w-]{10,64}$/;
const fraction = z.number().min(0).max(1);
const inside = (start: number, size: number) => start + size <= 1 + 1e-9;
/** A rectangle around a person in their photo (Person.photoCrop), inside the photo. */
export const photoCropSchema = z
  .strictObject({ x: fraction, y: fraction, w: fraction.min(MIN_CROP), h: fraction.min(MIN_CROP) })
  .refine((c) => inside(c.x, c.w) && inside(c.y, c.h), "The rectangle must be inside the photo");

export const operationSchema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("createPerson"),
    tempId,
    name,
    gender,
    birthYear: year.optional(),
    birthMonth: month.optional(),
    birthDay: day.optional(),
    deathYear: year.optional(),
    deathMonth: month.optional(),
    deathDay: day.optional(),
  }),
  z.strictObject({
    op: z.literal("updatePerson"),
    personId: ref,
    set: z.strictObject({
      name: name.optional(),
      gender: gender.optional(),
      birthYear: year.nullable().optional(), // null clears it
      birthMonth: month.nullable().optional(),
      birthDay: day.nullable().optional(),
      deathYear: year.nullable().optional(),
      deathMonth: month.nullable().optional(),
      deathDay: day.nullable().optional(),
    }),
  }),
  z.strictObject({
    op: z.literal("createUnion"),
    tempId: tempId.optional(),
    partnerIds: z.union([z.tuple([ref]), z.tuple([ref, ref])]),
    status: unionStatus,
    // When they married (an owner request after the final check); the planner checks the whole date.
    marriageYear: year.optional(),
    marriageMonth: month.optional(),
    marriageDay: day.optional(),
  }),
  z.strictObject({
    op: z.literal("updateUnion"),
    unionId: ref,
    set: z.strictObject({
      status: unionStatus.optional(),
      marriageYear: year.nullable().optional(), // null clears it
      marriageMonth: month.nullable().optional(),
      marriageDay: day.nullable().optional(),
    }),
  }),
  z.strictObject({ op: z.literal("addChild"), unionId: ref, childId: ref }),
  z.strictObject({
    op: z.literal("createSheet"),
    tempId: tempId.optional(),
    title: sheetTitle,
    rootPersonId: ref,
    pinned: z.boolean().optional(),
    hideChildrenOf: ref.optional(), // one of the root's couples: its children aren't shown on this sheet
  }),
  z.strictObject({ op: z.literal("addToSheet"), sheetId: ref, personId: ref }),
  z.strictObject({
    op: z.literal("setPhoto"),
    personId: ref,
    photoId: z.string().regex(PHOTO_ID, "Not a photo id").nullable(), // null removes it
    crop: photoCropSchema.nullable().optional(), // the rectangle around them; absent or null: none
  }),
  // UI only, never offered to the AI:
  z.strictObject({ op: z.literal("deletePerson"), personId: ref }),
  z.strictObject({ op: z.literal("deleteSheet"), sheetId: ref }), // never a pinned sheet, nor the last one
  z.strictObject({ op: z.literal("restorePerson"), personId: ref }),
  z.strictObject({ op: z.literal("addPartner"), unionId: ref, personId: ref }), // a single parent's partner
  z.strictObject({
    op: z.literal("updateSheet"),
    sheetId: ref,
    set: z.strictObject({ title: sheetTitle.optional(), pinned: z.boolean().optional() }),
  }),
  z.strictObject({ op: z.literal("reorderSheets"), sheetIds: z.array(ref).min(1).max(1000) }), // every sheet, in tab order
]);

/** People one batch may add: an import's limit (step 10), far above any edit by hand or the chat. */
export const MAX_NEW_PEOPLE = 2000;

export const operationsSchema = z
  .array(operationSchema)
  .min(1, "Nothing to apply")
  .max(20_000, "Too many changes at once")
  .refine((ops) => ops.filter((op) => op.op === "createPerson").length <= MAX_NEW_PEOPLE, `At most ${MAX_NEW_PEOPLE} people can be added at once`);

export type Operation = z.infer<typeof operationSchema>;
