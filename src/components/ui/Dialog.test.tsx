import { Activity } from "react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DialogButton } from "./Dialog";

// jsdom has no modal dialogs: stand-ins that only open and close it (browsers make the page inert).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

function Example({ bare = false }: { bare?: boolean }) {
  return (
    <DialogButton title="Create a family group" description="Start with your parents' names." bare={bare} button="New group" buttonClassName="">
      {(close) => (
        <button type="button" onClick={close}>
          Cancel
        </button>
      )}
    </DialogButton>
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "New group" }));
const dialog = () => document.querySelector("dialog")!;

describe("Dialog (the production look)", () => {
  test("its button opens it, named by its heading, with the description and the content", () => {
    render(<Example />);
    expect(screen.getByRole("button", { name: "New group" }).getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull(); // nothing inside until it opens
    open();
    expect(dialog().open).toBe(true);
    expect(screen.getByRole("dialog", { name: "Create a family group" })).toBeDefined();
    expect(screen.getByText("Start with your parents' names.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  test("Close, Escape, the content's own close and a click outside the box all end it; a click inside doesn't", () => {
    render(<Example />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dialog().open).toBe(false);

    open();
    fireEvent(dialog(), new Event("cancel", { cancelable: true })); // what Escape sends
    expect(dialog().open).toBe(false);

    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog().open).toBe(false);

    open();
    fireEvent.click(screen.getByText("Start with your parents' names."));
    expect(dialog().open).toBe(true);
    fireEvent.click(dialog()); // the backdrop around the box
    expect(dialog().open).toBe(false);
  });

  test("a bare dialog leaves the heading and Close to its content, and is named by its title", () => {
    render(<Example bare />);
    open();
    expect(screen.getByRole("dialog", { name: "Create a family group" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.queryByText("Start with your parents' names.")).toBeNull();
  });

  test("hiding its page closes it (a modal left open would make the next page inert), and it comes back closed", () => {
    // What Next.js does to the page someone leaves, keeping it for Back.
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <Example />
      </Activity>
    );
    const { rerender } = render(page("visible"));
    open();
    expect(dialog().open).toBe(true);
    rerender(page("hidden"));
    expect(dialog().open).toBe(false);
    rerender(page("visible"));
    expect(dialog().open).toBe(false);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});
