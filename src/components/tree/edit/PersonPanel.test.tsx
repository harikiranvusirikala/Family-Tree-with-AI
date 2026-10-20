import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GroupTree } from "@/tree/types";
import { PersonPanel } from "./PersonPanel";

afterEach(cleanup);

// Jerry Willow married in: the Cruz family sheet, his given sheet, and a tab of his own made later.
const tree: GroupTree = {
  persons: [
    { id: "alexander", name: "Alexander Cruz", gender: "male" },
    { id: "cynthia", name: "Cynthia Willow", gender: "female" },
    { id: "jerry", name: "Jerry Willow", gender: "male" },
  ],
  unions: [{ id: "willows", partnerIds: ["cynthia"], status: "married", childIds: ["jerry"] }],
  sheets: [
    { id: "willows-tab", title: "The Willows", rootPersonId: "jerry", extraPersonIds: [], pinned: false, order: 0 },
    { id: "jerry-tab", title: "Jerry Willow's family", rootPersonId: "jerry", extraPersonIds: [], pinned: true, order: 1 },
    { id: "cruz-tab", title: "Cruz family", rootPersonId: "alexander", extraPersonIds: [], pinned: true, order: 0 },
  ],
};

function panel(personId: string, currentSheetId: string, canEdit = true) {
  const onOpenSheet = vi.fn();
  render(
    <PersonPanel
      person={tree.persons.find((p) => p.id === personId)!}
      tree={tree}
      canEdit={canEdit}
      pending={false}
      run={async () => null}
      onSelect={() => {}}
      onClose={() => {}}
      onDelete={() => {}}
      currentSheetId={currentSheetId}
      onOpenSheet={onOpenSheet}
    />,
  );
  return onOpenSheet;
}

const goTo = () => screen.queryAllByRole("button", { name: /^Go to / }).map((b) => b.textContent);

describe("going to a person's own sheet (owner request)", () => {
  test("each sheet rooted at them, in tab order, opens that sheet", () => {
    const onOpenSheet = panel("jerry", "cruz-tab");
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
