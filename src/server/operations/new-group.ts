import { z } from "zod";
import { personName, type Operation } from "./schema";

// F2: a new group starts with a couple, optionally the user as their child, and two pinned sheets.

export const groupName = z.string().trim().min(1, "Give the group a name").max(120);

export const newGroupSchema = z.strictObject({
  groupName,
  fatherName: personName,
  motherName: personName,
  child: z
    .strictObject({ name: personName, gender: z.enum(["male", "female"], { error: "Choose male or female" }) })
    .optional(),
});

export type NewGroup = z.infer<typeof newGroupSchema>;

/** Temporary ids of the two pinned sheets, to find their real ids in the ApplyResult. */
export const FATHER_SHEET = "new:father-sheet";
export const MOTHER_SHEET = "new:mother-sheet";

/** The new group's first records: "<Father>'s family" and "<Mother>'s family", pinned in that order. */
export function newGroupOperations({ fatherName, motherName, child }: NewGroup): Operation[] {
  return [
    { op: "createPerson", tempId: "new:father", name: fatherName, gender: "male" },
    { op: "createPerson", tempId: "new:mother", name: motherName, gender: "female" },
    { op: "createUnion", tempId: "new:parents", partnerIds: ["new:father", "new:mother"], status: "married" },
    ...(child
      ? ([
          { op: "createPerson", tempId: "new:child", name: child.name, gender: child.gender },
          { op: "addChild", unionId: "new:parents", childId: "new:child" },
        ] satisfies Operation[])
      : []),
    { op: "createSheet", tempId: FATHER_SHEET, title: `${fatherName.trim()}'s family`, rootPersonId: "new:father", pinned: true },
    { op: "createSheet", tempId: MOTHER_SHEET, title: `${motherName.trim()}'s family`, rootPersonId: "new:mother", pinned: true },
  ];
}
