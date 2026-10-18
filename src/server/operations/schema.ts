import { z } from "zod";

// ARCHITECTURE.md §10. Manual edits, confirmed AI proposals and imports all become these operations.

const id = z.string().regex(/^[a-f\d]{24}$/i, "Not a valid id");
const tempId = z.string().regex(/^new:[\w-]{1,64}$/, 'Temporary ids look like "new:1"');
/** An existing id, or a temporary id created earlier in the same batch. */
const ref = z.union([id, tempId]);
const name = z.string().trim().min(1, "Name is required").max(120);
const gender = z.enum(["male", "female"]);
const year = z.number().int().min(1000).max(2200);
const unionStatus = z.enum(["married", "divorced"]);

export const operationSchema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("createPerson"),
    tempId,
    name,
    gender,
    birthYear: year.optional(),
    deathYear: year.optional(),
  }),
  z.strictObject({
    op: z.literal("updatePerson"),
    personId: ref,
    set: z.strictObject({
      name: name.optional(),
      gender: gender.optional(),
      birthYear: year.nullable().optional(), // null clears it
      deathYear: year.nullable().optional(),
    }),
  }),
  z.strictObject({
    op: z.literal("createUnion"),
    tempId: tempId.optional(),
    partnerIds: z.union([z.tuple([ref]), z.tuple([ref, ref])]),
    status: unionStatus,
  }),
  z.strictObject({ op: z.literal("updateUnion"), unionId: ref, status: unionStatus }),
  z.strictObject({ op: z.literal("addChild"), unionId: ref, childId: ref }),
  z.strictObject({
    op: z.literal("createSheet"),
    tempId: tempId.optional(),
    title: z.string().trim().min(1, "Title is required").max(120),
    rootPersonId: ref,
    pinned: z.boolean().optional(),
  }),
  z.strictObject({ op: z.literal("addToSheet"), sheetId: ref, personId: ref }),
  z.strictObject({ op: z.literal("setPhoto"), personId: ref, photoId: z.string().min(1).max(200) }),
  // UI only, never offered to the AI:
  z.strictObject({ op: z.literal("deletePerson"), personId: ref }),
  z.strictObject({ op: z.literal("restorePerson"), personId: ref }),
]);

export const operationsSchema = z.array(operationSchema).min(1, "Nothing to apply").max(5000);

export type Operation = z.infer<typeof operationSchema>;
