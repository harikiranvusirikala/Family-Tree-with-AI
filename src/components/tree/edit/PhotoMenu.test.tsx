import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { standInModalDialogs } from "@test/dialogs";
import type { GroupTree } from "@/tree/types";
import { CloudNameContext } from "../photo";
import { PersonPanel } from "./PersonPanel";
import { PhotoMenu } from "./PhotoMenu";

beforeAll(standInModalDialogs);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const group = "groups/65f0c0ffee0000000000abcd";
const family = (jakesPhoto?: string, taylorsPhoto?: string): GroupTree => ({
  persons: [
    { id: "jake", name: "Jake Cruz", gender: "male", ...(jakesPhoto && { photoId: jakesPhoto }) },
    { id: "taylor", name: "Taylor Humes", gender: "female", ...(taylorsPhoto && { photoId: taylorsPhoto }) },
  ],
  unions: [],
  sheets: [{ id: "tab", title: "Cruz family", rootPersonId: "jake", extraPersonIds: [], pinned: true, order: 0 }],
});

function menu(tree: GroupTree) {
  const run = vi.fn(async () => ({}));
  render(
    <CloudNameContext value="demo">
      <PhotoMenu person={tree.persons[0]} tree={tree} people={tree.persons.slice(1)} signUpload={vi.fn()} pending={false} run={run} onError={() => {}} />
    </CloudNameContext>,
  );
  return { run };
}

const items = () => screen.getAllByRole("menuitem").map((item) => item.textContent);
const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Photo options for Jake Cruz" }));

describe("the photo menu in the person panel (owner request)", () => {
  test("no photo, and none in the tree: the photo opens the file picker straight away", () => {
    const picker = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    menu(family());
    expect(screen.queryByRole("button", { name: "Photo options for Jake Cruz" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add a photo of Jake Cruz" }));
    expect(picker).toHaveBeenCalled();
  });

  test("no photo, but others in the tree: upload one or use one of theirs", () => {
    menu(family(undefined, `${group}/taylor`));
    openMenu();
    expect(items()).toEqual(["Upload a photo…", "Use a photo from this tree…"]);
  });

  test("with a photo: change, adjust, use another from the tree, remove", () => {
    menu(family(`${group}/jake`, `${group}/taylor`));
    openMenu();
    expect(items()).toEqual(["Change photo…", "Adjust photo…", "Use a photo from this tree…", "Remove photo…"]);
    cleanup();
    menu(family(`${group}/shared`, `${group}/shared`)); // the only photo in the tree is already his
    openMenu();
    expect(items()).toEqual(["Change photo…", "Adjust photo…", "Remove photo…"]);
  });

  test("using a photo from the tree: pick it, then the whole photo or where he is in it", () => {
    const { run } = menu(family(undefined, `${group}/taylor`));
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Use a photo from this tree…" }));
    const tiles = within(screen.getByRole("list", { name: "Photos in this tree" })).getAllByRole("button");
    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual(["Photo of Taylor Humes"]);
    fireEvent.click(tiles[0]);
    const dialog = screen.getByRole("dialog", { name: "Which one is Jake Cruz?" });
    expect(within(dialog).getByRole("button", { name: "Save" })).toHaveProperty("disabled", true); // nothing drawn yet
    fireEvent.click(within(dialog).getByRole("button", { name: "Whole photo" }));
    expect(run).toHaveBeenCalledWith([{ op: "setPhoto", personId: "jake", photoId: `${group}/taylor` }]);
  });

  test("Adjust photo with the keyboard: the arrows place a rectangle, Save keeps it", async () => {
    const { run } = menu(family(`${group}/jake`));
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Adjust photo…" }));
    const dialog = screen.getByRole("dialog", { name: "Which one is Jake Cruz?" });
    const photo = within(dialog).getByRole("group", { name: "The photo: where is Jake Cruz?" });
    fireEvent.load(photo.querySelector("img")!);
    fireEvent.keyDown(photo, { key: "ArrowRight" }); // the middle of the photo
    fireEvent.keyDown(photo, { key: "ArrowRight" });
    fireEvent.keyDown(photo, { key: "ArrowDown", shiftKey: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(run).toHaveBeenCalledWith([{ op: "setPhoto", personId: "jake", photoId: `${group}/jake`, crop: { x: 0.26, y: 0.25, w: 0.5, h: 0.51 } }]);
  });

  test("Remove says whether the photo is deleted or stays for others", () => {
    const shared = menu(family(`${group}/shared`, `${group}/shared`));
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove photo…" }));
    expect(screen.getByRole("dialog", { name: "Remove photo?" }).textContent).toContain("It comes off Jake Cruz's card, and stays for the other person who uses it.");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(shared.run).toHaveBeenCalledWith([{ op: "setPhoto", personId: "jake", photoId: null }]);
    cleanup();
    menu(family(`${group}/jake`));
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove photo…" }));
    expect(screen.getByRole("dialog", { name: "Remove photo?" }).textContent).toContain("Jake Cruz's photo will be deleted, so this can't be undone.");
  });

  test("a Viewer gets the photo with no button", () => {
    const tree = family(`${group}/jake`);
    render(
      <CloudNameContext value="demo">
        <PersonPanel person={tree.persons[0]} tree={tree} canEdit={false} pending={false} run={vi.fn()} onSelect={() => {}} onClose={() => {}} onDelete={() => {}} signPhotoUpload={vi.fn()} currentSheetId="tab" onOpenSheet={() => {}} />
      </CloudNameContext>,
    );
    expect(screen.queryByRole("button", { name: /photo/i })).toBeNull();
  });
});
