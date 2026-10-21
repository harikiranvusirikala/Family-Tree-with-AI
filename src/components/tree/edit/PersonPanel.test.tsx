import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GroupTree } from "@/tree/types";
import { PersonPanel } from "./PersonPanel";

afterEach(cleanup);

// Jerry Willow married in: the Cruz family sheet, his given sheet, and a tab of his own made later.
// His parents, Cynthia Willow and Fred Lambert, have no sheets.
const tree: GroupTree = {
  persons: [
    { id: "alexander", name: "Alexander Cruz", gender: "male" },
    { id: "cynthia", name: "Cynthia Willow", gender: "female" },
    { id: "fred", name: "Fred Lambert", gender: "male" },
    { id: "jerry", name: "Jerry Willow", gender: "male" },
  ],
  unions: [{ id: "willows", partnerIds: ["cynthia", "fred"], status: "married", childIds: ["jerry"] }],
  sheets: [
    { id: "willows-tab", title: "The Willows", rootPersonId: "jerry", extraPersonIds: [], pinned: false, order: 0 },
    { id: "jerry-tab", title: "Jerry Willow's family", rootPersonId: "jerry", extraPersonIds: [], pinned: true, order: 1 },
    { id: "cruz-tab", title: "Cruz family", rootPersonId: "alexander", extraPersonIds: [], pinned: true, order: 0 },
  ],
};

function panel(personId: string, currentSheetId: string, canEdit = true, onFindInList?: () => void, onShowInNetwork?: () => void) {
  const onOpenSheet = vi.fn();
  const run = vi.fn(async () => ({ "new:sheet": "new-tab" }));
  render(
    <PersonPanel
      person={tree.persons.find((p) => p.id === personId)!}
      tree={tree}
      canEdit={canEdit}
      pending={false}
      run={run}
      onSelect={() => {}}
      onClose={() => {}}
      onDelete={() => {}}
      currentSheetId={currentSheetId}
      onOpenSheet={onOpenSheet}
      onFindInList={onFindInList}
      onShowInNetwork={onShowInNetwork}
    />,
  );
  return { onOpenSheet, run };
}

const goTo = () => screen.queryAllByRole("button", { name: /^Go to / }).map((b) => b.textContent);

describe("going to a person's own sheet (owner request)", () => {
  test("each sheet rooted at them, in tab order, opens that sheet", () => {
    const { onOpenSheet } = panel("jerry", "cruz-tab");
    expect(goTo()).toEqual(["Go to Jerry Willow's family", "Go to The Willows"]);
    fireEvent.click(screen.getByRole("button", { name: "Go to The Willows" }));
    expect(onOpenSheet).toHaveBeenCalledWith("willows-tab");
  });

  test("not the sheet that's open", () => {
    panel("jerry", "jerry-tab");
    expect(goTo()).toEqual(["Go to The Willows"]);
  });

  test("nothing for someone without a sheet", () => {
    panel("cynthia", "cruz-tab");
    expect(goTo()).toEqual([]);
  });

  test("Viewers get it too", () => {
    panel("jerry", "cruz-tab", false);
    expect(screen.queryByRole("button", { name: "Edit details" })).toBeNull();
    expect(goTo()).toEqual(["Go to Jerry Willow's family", "Go to The Willows"]);
  });
});

describe("creating someone's own sheet later (owner request)", () => {
  const create = () => screen.queryByRole("button", { name: "Create their own sheet" });
  const open = () => fireEvent.click(create()!);
  const form = () => screen.getByRole("form", { name: "Create their own sheet" });

  test("offered to someone without a sheet, for Maintain and up", () => {
    panel("cynthia", "cruz-tab");
    expect(create()).not.toBeNull();
    cleanup();
    panel("jerry", "cruz-tab"); // he has his sheets
    expect(create()).toBeNull();
    cleanup();
    panel("cynthia", "cruz-tab", false);
    expect(create()).toBeNull();
  });

  test("a woman's sheet starts by leaving out her children with her partner, and saves that couple", async () => {
    const { run } = panel("cynthia", "cruz-tab");
    open();
    expect((screen.getByRole("textbox", { name: "Sheet title" }) as HTMLInputElement).value).toBe("Cynthia Willow's family");
    expect(screen.getByRole("radio", { name: "Leave out her children with Fred Lambert" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Show all her children" })).toHaveProperty("checked", false);
    fireEvent.submit(form());
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith([
      { op: "createSheet", tempId: "new:sheet", title: "Cynthia Willow's family", rootPersonId: "cynthia", hideChildrenOf: "willows" },
    ]);
  });

  test("a man's starts by showing all his children; the title is required", async () => {
    const { run } = panel("fred", "cruz-tab");
    open();
    expect(screen.getByRole("radio", { name: "Show all his children" })).toHaveProperty("checked", true);
    fireEvent.change(screen.getByRole("textbox", { name: "Sheet title" }), { target: { value: " " } });
    fireEvent.submit(form());
    expect(screen.getByRole("alert").textContent).toBe("Enter a title of up to 120 characters.");
    expect(run).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Sheet title" }), { target: { value: "The Lamberts" } });
    fireEvent.submit(form());
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith([{ op: "createSheet", tempId: "new:sheet", title: "The Lamberts", rootPersonId: "fred" }]));
  });
});

describe("on ★ Everyone: going to a sheet that shows them (owner request)", () => {
  test("someone without a sheet of their own gets the first sheet, in tab order, that shows them", () => {
    const { onOpenSheet } = panel("cynthia", "everyone");
    expect(goTo()).toEqual(["Go to Jerry Willow's family"]); // Cruz family, first, doesn't show her
    fireEvent.click(screen.getByRole("button", { name: "Go to Jerry Willow's family" }));
    expect(onOpenSheet).toHaveBeenCalledWith("jerry-tab");
  });

  test("their own sheets aren't repeated, and on a sheet there's nothing extra", () => {
    panel("jerry", "everyone");
    expect(goTo()).toEqual(["Go to Jerry Willow's family", "Go to The Willows"]);
    cleanup();
    panel("cynthia", "cruz-tab");
    expect(goTo()).toEqual([]);
  });
});

describe("Find in list (★ Everyone, part 2, owner request)", () => {
  const findInList = () => screen.queryByRole("button", { name: "Find in list" });

  test("offered when given (on sheets and the Tree), after the Go to buttons, for Viewers too", () => {
    const onFindInList = vi.fn();
    panel("jerry", "cruz-tab", false, onFindInList);
    expect(screen.getAllByRole("button", { name: /^(Go to |Find in list)/ }).map((b) => b.textContent)).toEqual(["Go to Jerry Willow's family", "Go to The Willows", "Find in list"]);
    fireEvent.click(findInList()!);
    expect(onFindInList).toHaveBeenCalled();
  });

  test("not in the List itself (not given)", () => {
    panel("cynthia", "everyone");
    expect(findInList()).toBeNull();
  });
});

describe("Show in network (★ Everyone, part 3, owner request)", () => {
  test("offered when given (on sheets, the Tree and the List), after Find in list, for Viewers too", () => {
    const onShowInNetwork = vi.fn();
    panel("cynthia", "cruz-tab", false, () => {}, onShowInNetwork);
    expect(screen.getAllByRole("button", { name: /^(Go to |Find in list|Show in network)/ }).map((b) => b.textContent)).toEqual(["Find in list", "Show in network"]);
    fireEvent.click(screen.getByRole("button", { name: "Show in network" }));
    expect(onShowInNetwork).toHaveBeenCalled();
  });

  test("not in the Network itself (not given)", () => {
    panel("cynthia", "everyone", true, () => {});
    expect(screen.queryByRole("button", { name: "Show in network" })).toBeNull();
  });
});
