import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GroupTree, Union } from "@/tree/types";
import { CouplePanel } from "./CouplePanel";

afterEach(cleanup);

// Steve and Arham married on 8 Sep 2008; Steve and Sammie, divorced, with no date added.
const tree: GroupTree = {
  persons: [
    { id: "steve", name: "Steve Cruz", gender: "male", birthYear: 1985 },
    { id: "arham", name: "Arham Chopra", gender: "female", birthYear: 1983 },
    { id: "sammie", name: "Sammie Chang", gender: "female", birthYear: 1985 },
  ],
  unions: [
    { id: "steve-arham", partnerIds: ["steve", "arham"], status: "married", marriageYear: 2008, marriageMonth: 9, marriageDay: 8, childIds: [] },
    { id: "steve-sammie", partnerIds: ["steve", "sammie"], status: "divorced", childIds: [] },
  ],
  sheets: [],
};

function panel(unionId: string, canEdit = true) {
  const run = vi.fn(async () => ({}));
  const union = tree.unions.find((u) => u.id === unionId) as Union;
  render(<CouplePanel union={union} tree={tree} canEdit={canEdit} pending={false} run={run} onSelect={() => {}} onClose={() => {}} />);
  return { run };
}
const field = (name: string) => screen.getByRole(name.endsWith("month") ? "combobox" : "spinbutton", { name }) as HTMLInputElement;
const set = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const save = () => fireEvent.submit(screen.getByRole("form", { name: "Marriage date" }));

describe("the marriage date in the couple panel (owner request)", () => {
  test("shows when they married; a Viewer can't change it", () => {
    panel("steve-arham", false);
    expect(screen.getByText("8 Sep 2008")).toBeDefined();
    expect(screen.queryByRole("button", { name: /marriage date/ })).toBeNull();
    cleanup();
    panel("steve-sammie", false);
    expect(screen.getByText("Not added")).toBeDefined();
  });

  test("Change marriage date opens the date as saved; saving sends only what changed", async () => {
    const { run } = panel("steve-arham");
    fireEvent.click(screen.getByRole("button", { name: "Change marriage date" }));
    expect([field("Marriage day").value, field("Marriage month").value, field("Marriage year").value]).toEqual(["8", "9", "2008"]);
    set("Marriage year", "2009");
    save();
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith([{ op: "updateUnion", unionId: "steve-arham", set: { marriageYear: 2009 } }]));
    await vi.waitFor(() => expect(screen.queryByRole("form", { name: "Marriage date" })).toBeNull());
  });

  test("emptying every field removes the date; nothing changed sends nothing", async () => {
    const { run } = panel("steve-arham");
    fireEvent.click(screen.getByRole("button", { name: "Change marriage date" }));
    save();
    await vi.waitFor(() => expect(screen.queryByRole("form", { name: "Marriage date" })).toBeNull());
    expect(run).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Change marriage date" }));
    set("Marriage day", "");
    set("Marriage month", "");
    set("Marriage year", "");
    save();
    await vi.waitFor(() =>
      expect(run).toHaveBeenCalledWith([{ op: "updateUnion", unionId: "steve-arham", set: { marriageYear: null, marriageMonth: null, marriageDay: null } }]),
    );
  });

  test("Add marriage date for a divorced couple; a date that isn't real is refused before saving", async () => {
    const { run } = panel("steve-sammie");
    fireEvent.click(screen.getByRole("button", { name: "Add marriage date" }));
    set("Marriage day", "30");
    set("Marriage month", "2");
    set("Marriage year", "2001");
    save();
    expect((await screen.findByRole("alert")).textContent).toBe("30 Feb 2001 isn't a real date.");
    expect(run).not.toHaveBeenCalled();
    set("Marriage day", "");
    save();
    expect((await screen.findByRole("alert")).textContent).toBe("Enter both the day and the month of the marriage, or neither.");
    set("Marriage month", "");
    save();
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith([{ op: "updateUnion", unionId: "steve-sammie", set: { marriageYear: 2001 } }]));
  });
});
