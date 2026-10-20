// @vitest-environment node
import { describe, expect, test } from "vitest";
import { applyPlan, sampleState, toGroupTree } from "@test/planning";
import { describeOperations } from "@/tree/describe";
import { runTool, type ToolContext } from "./handlers";
import { proposalNote, rosterNote, ROSTER_LIMIT } from "./prompt";
import { READ_TOOLS, toolsFor } from "./tools";

const state = sampleState();
const tree = toGroupTree(state);
const context = (pending: ToolContext["pending"] = []): ToolContext => ({ groupId: state.persons[0].groupId, state, tree, pending });
const idOf = (name: string) => tree.persons.find((p) => p.name === name)!.id;

describe("read tools", () => {
  test("search_people finds people by any part of the name, accents and case aside, and by year", () => {
    const found = JSON.parse(runTool("search_people", { name: "timothy cruz", year: null }, context()).content);
    expect(found.people.map((p: { born: number }) => p.born).sort()).toEqual([1880, 1940]);
    const byYear = JSON.parse(runTool("search_people", { name: "Timothy", year: 1880 }, context()).content);
    expect(byYear.people).toHaveLength(1);
    expect(byYear.people[0]).toMatchObject({ name: "Timothy Cruz", born: 1880, partners: ["Amy Harolds"] });
    expect(runTool("search_people", { name: "Zebedee", year: null }, context())).toMatchObject({ isError: false, content: 'No one in this family matches "Zebedee".' });
  });

  test("get_person gives parents, partners with their couple, children and sheets", () => {
    const jake = JSON.parse(runTool("get_person", { personId: idOf("Jake Cruz") }, context()).content);
    expect(jake.parents.map((p: { name: string }) => p.name)).toEqual(["Alexander Cruz", "Jerry Willow"]);
    expect(jake.partners).toMatchObject([{ name: "Taylor Humes", status: "married", coupleId: expect.any(String) }]);
    expect(jake.children.map((p: { name: string }) => p.name).sort()).toEqual(["Christina Cruz", "Cullen Cruz", "Marie Cruz"]);
    expect(jake.sheets.map((s: { title: string }) => s.title).sort()).toEqual(["Cruz family", "Jerry Willow's family"]);
    expect(runTool("get_person", { personId: "0".repeat(24) }, context())).toMatchObject({ isError: true });
  });

  test("bad input comes back as an error the model can fix, and the proposal is untouched", () => {
    const pending = [{ op: "createPerson", tempId: "new:1", name: "A", gender: "male" } as const];
    expect(runTool("get_person", { personId: "jake" }, context(pending))).toMatchObject({ isError: true, pending });
    expect(runTool("delete_person", {}, context(pending))).toMatchObject({ isError: true, pending });
  });
});

describe("proposal tools", () => {
  test("temporary ids chain: a new person, her marriage and her own sheet, all checked by the planner", () => {
    const ravi = idOf("Arjun Patel");
    const added = runTool("add_person", { name: "Priya Sharma", gender: "female", birthYear: 1985, deathYear: null }, context());
    expect(added).toMatchObject({ isError: false, content: expect.stringContaining("Priya Sharma is new:1") });
    const married = runTool("add_marriage", { personId: "new:1", partnerId: ravi, status: "married" }, context(added.pending));
    expect(married.content).toContain("the couple is new:2");
    const sheet = runTool("create_sheet", { rootPersonId: "new:1", title: "Priya Sharma's family" }, context(married.pending));
    expect(sheet.pending.map((op) => op.op)).toEqual(["createPerson", "createUnion", "createSheet"]);

    const after = toGroupTree(applyPlan(state, sheet.pending));
    expect(after.sheets.map((s) => s.title)).toContain("Priya Sharma's family");
    expect(describeOperations(sheet.pending, tree)).toEqual([
      "Add Priya Sharma (female, 1985)",
      "Priya Sharma and Arjun Patel (1962) are married",
      'New sheet "Priya Sharma\'s family" about Priya Sharma',
    ]);
  });

  test("add_child uses the parents' couple, or proposes one first", () => {
    const baby = runTool("add_person", { name: "Mia Cruz", gender: "female", birthYear: null, deathYear: null }, context());
    const child = runTool("add_child", { parentIds: [idOf("Taylor Humes"), idOf("Jake Cruz")], childId: "new:1" }, context(baby.pending));
    expect(child.pending.at(-1)).toMatchObject({ op: "addChild", childId: "new:1" });
    expect(child.pending).toHaveLength(2); // their couple exists

    const alone = runTool("add_child", { parentIds: [idOf("Amelia Young")], childId: "new:1" }, context(baby.pending));
    expect(alone.pending.slice(1).map((op) => op.op)).toEqual(["createUnion", "addChild"]);
    expect(describeOperations(alone.pending, tree).at(-1)).toBe("Mia Cruz is the child of Amelia Young (2001)");
  });

  test("what the planner would refuse is not added, and the model hears why", () => {
    const refused = runTool("add_child", { parentIds: [idOf("Jake Cruz")], childId: idOf("Alexander Cruz") }, context());
    expect(refused).toMatchObject({ isError: true, pending: [] });
    expect(refused.content).toMatch(/^Not added to the proposal: Alexander Cruz (already has parents|is an ancestor)/);
    expect(runTool("add_marriage", { personId: "new:7", partnerId: idOf("Jake Cruz"), status: "married" }, context())).toMatchObject({
      isError: true,
      content: expect.stringContaining("new:7 is not created earlier"),
    });
  });

  test("update_person changes only what is given, e.g. a death year", () => {
    const taylor = idOf("Taylor Humes");
    const update = runTool("update_person", { personId: taylor, name: null, gender: null, birthYear: null, deathYear: 2024 }, context());
    expect(update.pending).toEqual([{ op: "updatePerson", personId: taylor, set: { deathYear: 2024 } }]);
    expect(describeOperations(update.pending, tree)).toEqual(["Change Taylor Humes (1955): death year to 2024"]);
    expect(runTool("update_person", { personId: taylor, name: null, gender: null, birthYear: null, deathYear: null }, context()).isError).toBe(true);
  });

  test("update_person with a new name also renames their sheet, as the edit form does", () => {
    const jerry = idOf("Jerry Willow");
    const update = runTool("update_person", { personId: jerry, name: "Jerry Willow-Cruz", gender: null, birthYear: null, deathYear: null }, context());
    expect(update.isError).toBeFalsy();
    expect(describeOperations(update.pending, tree)).toEqual([
      "Change Jerry Willow (1920 – 1989): name to Jerry Willow-Cruz",
      `Rename the sheet "Jerry Willow's family" to "Jerry Willow-Cruz's family"`,
    ]);
  });
});

describe("role filtering and the notes", () => {
  test("Viewers get the read tools only; Maintain and up get all eight, every one strict", () => {
    expect(toolsFor("view")).toEqual(READ_TOOLS);
    for (const role of ["maintain", "admin", "owner"] as const) expect(toolsFor(role)).toHaveLength(8);
    for (const tool of toolsFor("owner")) {
      expect(tool).toMatchObject({ strict: true, input_schema: { additionalProperties: false } });
      expect(tool.input_schema.required).toEqual(Object.keys(tool.input_schema.properties as object));
    }
  });

  test("the family list: everyone with ids, parents and partners, names as quoted data, and the sheets", () => {
    const note = rosterNote(tree, "maintain");
    expect(note).toContain("The user can propose changes");
    expect(note).toContain(`${idOf("Jake Cruz")} | "Jake Cruz" | male | 1945 – 2022 | parents `);
    expect(note).toContain('| "Cruz family"');
    expect(note.split("\n").filter((l) => /^[a-f\d]{24} \| "/.test(l))).toHaveLength(36 + 2); // people and sheets
    expect(rosterNote(tree, "view")).toContain("view-only access");
  });

  test(`at most ${ROSTER_LIMIT} people are listed; the rest are found with search_people`, () => {
    const many = { ...tree, persons: Array.from({ length: ROSTER_LIMIT + 5 }, (_, i) => ({ id: i.toString(16).padStart(24, "0"), name: `Person ${i}`, gender: "male" as const })), unions: [] };
    expect(rosterNote(many, "view")).toContain("(5 more people are not listed; use search_people to find them.)");
  });

  test("proposal notes", () => {
    expect(proposalNote({ discarded: true })).toContain("discarded");
    expect(proposalNote({ confirmed: { "new:1": "a".repeat(24) } })).toContain(`new:1 is now ${"a".repeat(24)}`);
  });
});
