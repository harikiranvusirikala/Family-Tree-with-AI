// @vitest-environment node
import { ObjectId } from "mongodb";
import { describe, expect, test } from "vitest";
import { FATHER_SHEET, MOTHER_SHEET, newGroupOperations, newGroupSchema } from "./new-group";
import { planOperations } from "./plan";

const plan = (input: Parameters<typeof newGroupOperations>[0]) =>
  planOperations(new ObjectId(), { persons: [], unions: [], sheets: [] }, newGroupOperations(input), "tester", new Date());

describe("newGroupOperations (F2)", () => {
  test("a couple, the user as their child, and two pinned sheets: Father's first", () => {
    const result = plan({
      groupName: "Sharma family",
      fatherName: "Ravi Sharma",
      motherName: "Anita Sharma",
      child: { name: "Priya Sharma", gender: "female" },
    });
    const persons = result.persons.inserted;
    expect(persons.map((p) => [p.name, p.gender])).toEqual([
      ["Ravi Sharma", "male"],
      ["Anita Sharma", "female"],
      ["Priya Sharma", "female"],
    ]);
    const [union] = result.unions.inserted;
    expect(union.partnerIds).toEqual([persons[0]._id, persons[1]._id]);
    expect(union.childIds).toEqual([persons[2]._id]);
    expect(result.sheets.inserted.map((s) => [s.title, s.pinned, s.order, s.rootPersonId])).toEqual([
      ["Ravi Sharma's family", true, 0, persons[0]._id],
      ["Anita Sharma's family", true, 1, persons[1]._id],
    ]);
    expect(result.idMap[FATHER_SHEET]).toBe(result.sheets.inserted[0]._id.toHexString());
    expect(result.idMap[MOTHER_SHEET]).toBe(result.sheets.inserted[1]._id.toHexString());
    // The mother's sheet leaves out the couple's children: they're on the father's (owner request).
    expect(result.sheets.inserted[0]).not.toHaveProperty("hideChildrenOf");
    expect(result.sheets.inserted[1].hideChildrenOf).toEqual(union._id);
  });

  test("without the user, just the couple", () => {
    const result = plan({ groupName: "Rao family", fatherName: "Suresh Rao", motherName: "Lakshmi Rao" });
    expect(result.persons.inserted).toHaveLength(2);
    expect(result.unions.inserted[0].childIds).toEqual([]);
    expect(result.sheets.inserted).toHaveLength(2);
  });
});

describe("newGroupSchema", () => {
  test("trims names and requires all three", () => {
    expect(newGroupSchema.parse({ groupName: " Rao family ", fatherName: " Suresh ", motherName: "Lakshmi" })).toEqual({
      groupName: "Rao family",
      fatherName: "Suresh",
      motherName: "Lakshmi",
    });
    expect(newGroupSchema.safeParse({ groupName: "", fatherName: "A", motherName: "B" }).error?.issues[0].message).toBe("Give the group a name");
    expect(newGroupSchema.safeParse({ groupName: "G", fatherName: " ", motherName: "B" }).success).toBe(false);
  });

  test("the user as a child needs a gender", () => {
    const result = newGroupSchema.safeParse({ groupName: "G", fatherName: "A", motherName: "B", child: { name: "C", gender: "" } });
    expect(result.error?.issues[0].message).toBe("Choose male or female");
  });
});
