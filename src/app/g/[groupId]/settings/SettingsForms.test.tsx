import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { standInModalDialogs } from "@test/dialogs";
import type { SettingsFormState } from "./actions";
import { DeleteGroup, LeaveGroup, TransferOwnership } from "./SettingsForms";

beforeAll(standInModalDialogs);
afterEach(cleanup);

type Action = (previous: SettingsFormState, form: FormData) => Promise<SettingsFormState>;
const action = (state: SettingsFormState = {}) => vi.fn<Action>(async () => state);
const groupId = "a".repeat(24);

describe("the settings page (the production look)", () => {
  test("Delete group… asks for the group's name in a dialog; its button waits until the name is typed exactly", async () => {
    const remove = action();
    render(<DeleteGroup name="Rao family" members={3} action={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete group…" }));
    const dialog = within(screen.getByRole("dialog", { name: "Delete this group" }));
    expect(dialog.getByText("Rao family disappears for everyone in it (3 members).")).toBeDefined();
    const confirm = dialog.getByRole("textbox", { name: "Confirm the group's name" });
    expect(document.activeElement).toBe(confirm);
    const button = dialog.getByRole("button", { name: "Delete group" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(confirm, { target: { value: "Rao" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(confirm, { target: { value: "Rao family " } }); // spaces around it don't matter, as on the server
    expect(button.disabled).toBe(false);
    await act(async () => fireEvent.click(button));
    expect(remove.mock.calls[0][1].get("confirm")).toBe("Rao family ");
  });

  test("a refused attempt keeps what was typed, with the message, in the dialog", async () => {
    const refuse = action({ error: "Type the group's name, Rao family tree, to confirm." });
    render(<DeleteGroup name="Rao family" members={1} action={refuse} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete group…" }));
    const dialog = within(screen.getByRole("dialog", { name: "Delete this group" }));
    expect(dialog.getByText("Rao family disappears for everyone in it (1 member).")).toBeDefined();
    fireEvent.change(dialog.getByRole("textbox", { name: "Confirm the group's name" }), { target: { value: "Rao family" } });
    await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Delete group" })));
    expect(dialog.getByRole("alert").textContent).toContain("to confirm");
    expect((dialog.getByRole("textbox", { name: "Confirm the group's name" }) as HTMLInputElement).value).toBe("Rao family");
  });

  test("Transfer ownership… names the chosen member in its dialog and sends their id", async () => {
    const transfer = action();
    const members = [
      { userId: "1".repeat(24), name: "Ada Admin", role: "Admin" },
      { userId: "2".repeat(24), name: "Max Maintainer", role: "Maintain" },
    ];
    render(<TransferOwnership groupId={groupId} name="Cruz family" members={members} action={transfer} />);
    fireEvent.change(screen.getByRole("combobox", { name: "New owner" }), { target: { value: "2".repeat(24) } });
    fireEvent.click(screen.getByRole("button", { name: "Transfer ownership…" }));
    const dialog = within(screen.getByRole("dialog", { name: "Transfer ownership" }));
    expect(dialog.getByText(/the owner of Cruz family\? They get every right you have now, and you become an Admin\./).textContent).toContain("Make Max Maintainer the owner");
    fireEvent.change(dialog.getByRole("textbox", { name: "Confirm the group's name" }), { target: { value: "Cruz family" } });
    await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Transfer ownership" })));
    const sent = transfer.mock.calls[0][1];
    expect([sent.get("userId"), sent.get("confirm")]).toEqual(["2".repeat(24), "Cruz family"]);
  });

  test("with nobody else in the group, transferring points to the Members page", () => {
    render(<TransferOwnership groupId={groupId} name="Cruz family" members={[]} action={action()} />);
    expect(screen.getByRole("link", { name: "Invite someone" }).getAttribute("href")).toBe(`/g/${groupId}/members`);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("Leave this group… asks first, with Cancel focused", async () => {
    const leave = vi.fn<() => Promise<SettingsFormState>>(async () => ({}));
    render(<LeaveGroup name="Cruz family" action={leave} />);
    fireEvent.click(screen.getByRole("button", { name: "Leave this group…" }));
    const dialog = within(screen.getByRole("dialog", { name: "Leave Cruz family?" }));
    expect(dialog.getByText("To come back, you'll need a new invite.")).toBeDefined();
    expect(document.activeElement).toBe(dialog.getByRole("button", { name: "Cancel" }));
    await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Leave" })));
    expect(leave).toHaveBeenCalledOnce();
  });
});
