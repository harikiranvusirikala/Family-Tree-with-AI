import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { GroupTree } from "@/tree/types";
import { PersonPanel, type WheelRelation } from "./PersonPanel";

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

/** A button's name: its aria-label (the views' tiles), else its words. */
const named = (button: HTMLElement) => button.getAttribute("aria-label") ?? button.textContent;

function panel(personId: string, currentSheetId: string, canEdit = true, onFindInList?: () => void, onShowInNetwork?: () => void, wheel: { onShowWheel?: () => void; relation?: WheelRelation } = {}) {
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
      onShowWheel={wheel.onShowWheel}
      relation={wheel.relation}
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

describe("adding parents: the mother's own sheet holds her side (owner request after the full dates)", () => {
  // Dad's sheet; Gran has her own, leaving out her children with Grandpa; Mum married in, with no sheet.
  const family: GroupTree = {
    persons: [
      { id: "dad", name: "Dad", gender: "male" },
      { id: "grandpa", name: "Grandpa", gender: "male" },
      { id: "gran", name: "Gran", gender: "female" },
      { id: "mum", name: "Mum", gender: "female" },
    ],
    unions: [
      { id: "grandparents", partnerIds: ["grandpa", "gran"], status: "married", childIds: ["dad"] },
      { id: "parents", partnerIds: ["dad", "mum"], status: "married", childIds: [] },
    ],
    sheets: [
      { id: "dad-tab", title: "Dad's family", rootPersonId: "dad", extraPersonIds: [], pinned: true, order: 0 },
      { id: "gran-tab", title: "Gran's family", rootPersonId: "gran", extraPersonIds: [], pinned: false, order: 1, hideChildrenOf: "grandparents" },
    ],
  };
  function addParents(personId: string, currentSheetId: string) {
    const onOpenSheet = vi.fn();
    const run = vi.fn(async () => ({}));
    render(
      <PersonPanel
        person={family.persons.find((p) => p.id === personId)!}
        tree={family}
        canEdit
        pending={false}
        run={run}
        onSelect={() => {}}
        onClose={() => {}}
        onDelete={() => {}}
        currentSheetId={currentSheetId}
        onOpenSheet={onOpenSheet}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add parents" }));
    const name = (who: string, value: string) => fireEvent.change(screen.getByRole("textbox", { name: `${who}'s name` }), { target: { value } });
    const save = () => fireEvent.submit(screen.getByRole("form", { name: "Add parents" }));
    return { onOpenSheet, run, name, save };
  }
  const note = () => screen.queryByText(/not on this sheet/)?.textContent;

  test("her box starts checked; with only a father, it saves him alone, with no sheet and no message", async () => {
    const { run, name, save } = addParents("grandpa", "dad-tab");
    expect(screen.getByRole("checkbox", { name: /Create their own sheet/ })).toHaveProperty("checked", true);
    name("Father", "Great-grandpa");
    save();
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    expect((run.mock.calls[0] as unknown as [{ op: string }[]])[0].map((o) => o.op)).toEqual(["createPerson", "createUnion", "addChild"]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("with a mother, the same save creates her sheet", async () => {
    const { run, name, save } = addParents("mum", "dad-tab");
    name("Father", "Nana's husband");
    name("Mother", "Nana");
    save();
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    expect((run.mock.calls[0] as unknown as [{ op: string }[]])[0]).toContainEqual(
      { op: "createSheet", tempId: "new:sheet-2", title: "Nana's family", rootPersonId: "new:parent-2", hideChildrenOf: "new:parents" },
    );
  });

  test("Gran's parents from Dad's sheet: the form says they'll be on her sheet, and saving opens it", async () => {
    const { onOpenSheet, run, name, save } = addParents("gran", "dad-tab");
    expect(note()).toBe("They'll be on Gran's family, not on this sheet. Saving opens it.");
    name("Father", "Great-grandpa");
    save();
    await vi.waitFor(() => expect(onOpenSheet).toHaveBeenCalledWith("gran-tab"));
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("no message where they'll show (her own sheet, Grandpa on Dad's) or with no sheet to open (Mum, who married in)", async () => {
    for (const [personId, sheetId] of [["gran", "gran-tab"], ["grandpa", "dad-tab"], ["mum", "dad-tab"]]) {
      const { onOpenSheet, run, name, save } = addParents(personId, sheetId);
      expect(note()).toBeUndefined();
      name("Father", "Someone");
      save();
      await vi.waitFor(() => expect(run).toHaveBeenCalled());
      expect(onOpenSheet).not.toHaveBeenCalled();
      cleanup();
    }
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
    expect(screen.getAllByRole("button", { name: /^(Go to |Find in list)/ }).map(named)).toEqual(["Go to Jerry Willow's family", "Go to The Willows", "Find in list"]);
    expect(findInList()!.textContent).toBe("List"); // a tile (the production look)
    fireEvent.click(findInList()!);
    expect(onFindInList).toHaveBeenCalled();
  });

  test("not in the List itself (not given)", () => {
    panel("cynthia", "everyone");
    expect(findInList()).toBeNull();
  });
});

describe("Show in network (★ Everyone, part 3, owner request)", () => {
  test("offered when given (on sheets, the Tree and the List), before Find in list, for Viewers too", () => {
    const onShowInNetwork = vi.fn();
    panel("cynthia", "cruz-tab", false, () => {}, onShowInNetwork);
    expect(screen.getAllByRole("button", { name: /^(Go to |Find in list|Show in network)/ }).map(named)).toEqual(["Show in network", "Find in list"]);
    fireEvent.click(screen.getByRole("button", { name: "Show in network" }));
    expect(onShowInNetwork).toHaveBeenCalled();
  });

  test("not in the Network itself (not given)", () => {
    panel("cynthia", "everyone", true, () => {});
    expect(screen.queryByRole("button", { name: "Show in network" })).toBeNull();
  });
});

describe("the Wheel in the panel (★ Everyone, part 4, owner request)", () => {
  test("elsewhere: Relatives wheel, first of the views' tiles, for Viewers too", () => {
    const onShowWheel = vi.fn();
    panel("cynthia", "cruz-tab", false, () => {}, () => {}, { onShowWheel });
    const tiles = screen.getAllByRole("button", { name: /^(Find in list|Show in network|Relatives wheel)/ });
    expect(tiles.map(named)).toEqual(["Relatives wheel", "Show in network", "Find in list"]);
    expect(tiles.map((tile) => tile.textContent)).toEqual(["Wheel", "Network", "List"]);
    fireEvent.click(screen.getByRole("button", { name: "Relatives wheel" }));
    expect(onShowWheel).toHaveBeenCalled();
  });

  test("in the Wheel: how they're related to the middle, the exact path, and Put in the middle", () => {
    const onMiddle = vi.fn();
    panel("jerry", "everyone", false, () => {}, () => {}, { relation: { names: "Koduku · Son", path: "Cynthia Willow's son", onMiddle } });
    const box = screen.getByRole("group", { name: "Relation" });
    expect(box.textContent).toBe("Koduku · SonCynthia Willow's sonPut in the middle");
    expect(screen.queryByRole("button", { name: "Relatives wheel" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Put in the middle" }));
    expect(onMiddle).toHaveBeenCalled();
  });

  test("the person in the middle", () => {
    panel("jerry", "everyone", false, undefined, undefined, { relation: { names: null, path: "" } });
    expect(screen.getByRole("group", { name: "Relation" }).textContent).toBe("In the middle of the wheel");
    expect(screen.queryByRole("button", { name: "Put in the middle" })).toBeNull();
  });
});

describe("marriage dates on the partner lines (owner request)", () => {
  test("each partner with the date they married, where known, and divorced marked", () => {
    const family: GroupTree = {
      persons: [
        { id: "steve", name: "Steve Cruz", gender: "male", birthYear: 1985 },
        { id: "sammie", name: "Sammie Chang", gender: "female" },
        { id: "arham", name: "Arham Chopra", gender: "female" },
        { id: "jo", name: "Jo Lee", gender: "female" },
      ],
      unions: [
        { id: "first", partnerIds: ["steve", "sammie"], status: "divorced", marriageYear: 2001, childIds: [] },
        { id: "second", partnerIds: ["steve", "arham"], status: "married", marriageYear: 2008, marriageMonth: 9, marriageDay: 8, childIds: [] },
        { id: "third", partnerIds: ["steve", "jo"], status: "married", childIds: [] },
      ],
      sheets: [{ id: "tab", title: "Steve Cruz's family", rootPersonId: "steve", extraPersonIds: [], pinned: true, order: 0 }],
    };
    render(
      <PersonPanel
        person={family.persons[0]}
        tree={family}
        canEdit={false}
        pending={false}
        run={vi.fn()}
        onSelect={() => {}}
        onClose={() => {}}
        onDelete={() => {}}
        currentSheetId="tab"
        onOpenSheet={() => {}}
      />,
    );
    // Each a row selecting them: the photo's initials (hidden from screen readers), the name, then the line under it.
    const partners = within(screen.getByText("Partners").nextElementSibling as HTMLElement).getAllByRole("button");
    expect(partners.map((row) => row.textContent)).toEqual(["SCSammie ChangMarried 2001 · divorced", "ACArham ChopraMarried 8 Sep 2008", "JLJo LeeMarried"]);
  });
});

describe("an age in the panel (birthdays and anniversaries, owner request)", () => {
  test("on the device's day: exact with a full birth date, about with a year, at death", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 21, 12));
    try {
      const people = [
        { id: "a", name: "Asha Rao", gender: "female" as const, birthYear: 1985, birthMonth: 10, birthDay: 22 },
        { id: "b", name: "Ravi Rao", gender: "male" as const, birthYear: 1960 },
        { id: "c", name: "Mohan Rao", gender: "male" as const, birthYear: 1930, deathYear: 2010 },
      ];
      const family: GroupTree = { persons: people, unions: [], sheets: [{ id: "tab", title: "Raos", rootPersonId: "a", extraPersonIds: [], pinned: true, order: 0 }] };
      const ages = people.map((person) => {
        render(<PersonPanel person={person} tree={family} canEdit={false} pending={false} run={vi.fn()} onSelect={() => {}} onClose={() => {}} onDelete={() => {}} currentSheetId="tab" onOpenSheet={() => {}} />);
        const text = screen.getByRole("heading", { name: person.name }).parentElement!.textContent;
        cleanup();
        return text;
      });
      expect(ages).toEqual(["Asha Rao22 Oct 198540 years old", "Ravi Rao1960About 66 years old", "Mohan Rao1930 – 2010Died aged about 80"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
