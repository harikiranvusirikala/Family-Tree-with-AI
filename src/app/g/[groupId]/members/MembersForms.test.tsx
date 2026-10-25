import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { standInModalDialogs } from "@test/dialogs";
import { ROLE_HINTS } from "@/server/members-rules";
import type { Role } from "@/server/roles";
import type { MemberFormState } from "./actions";
import { CreateLinkButton, InviteButton, LinkRow, MemberRow, RequestRow } from "./MembersForms";

beforeAll(standInModalDialogs);
afterEach(cleanup);

type FormAction = (previous: MemberFormState, form: FormData) => Promise<MemberFormState>;
type ButtonAction = () => Promise<MemberFormState>;
const done = (state: MemberFormState = {}) => vi.fn<FormAction>(async () => state);
const removed = () => vi.fn<ButtonAction>(async () => ({}));

function Row({ role = "view", isYou = false, changeRole = done(), remove = removed() }: { role?: Role; isYou?: boolean; changeRole?: FormAction; remove?: ButtonAction }) {
  return (
    <ul>
      <MemberRow
        member={{ name: "Vera Viewer", email: "vera@example.com", role, joined: "18 Oct 2026" }}
        groupName="Cruz family"
        isYou={isYou}
        changeRole={changeRole}
        remove={remove}
      />
    </ul>
  );
}

describe("the members page (the production look)", () => {
  test("a role is a menu: each role with what it lets them do, the current one ticked; a choice shows at once while it saves", async () => {
    let finish!: (state: MemberFormState) => void;
    const changeRole = vi.fn<FormAction>(() => new Promise((resolve) => (finish = resolve)));
    render(<Row changeRole={changeRole} />);
    expect(screen.getByText("18 Oct 2026")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Role for Vera Viewer: View" }));
    const menu = within(screen.getByRole("menu", { name: "Role for Vera Viewer" }));
    expect(menu.getAllByRole("menuitemradio").map((item) => [item.getAttribute("aria-checked"), item.textContent])).toEqual([
      ["true", `View${ROLE_HINTS.view}`],
      ["false", `Maintain${ROLE_HINTS.maintain}`],
      ["false", `Admin${ROLE_HINTS.admin}`],
    ]);
    expect(menu.getByRole("menuitemradio", { name: "Admin", description: ROLE_HINTS.admin })).toBeDefined();

    fireEvent.click(menu.getByRole("menuitemradio", { name: "Maintain" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Role for Vera Viewer: Maintain" })).toBeDefined(); // before the server answers
    expect(changeRole.mock.calls[0][1].get("role")).toBe("maintain");
    await act(async () => finish({ done: "Role changed." }));
    expect(screen.getByRole("status").textContent).toBe("Role changed.");
  });

  test("choosing the role it has already saves nothing", () => {
    const changeRole = done();
    render(<Row changeRole={changeRole} />);
    fireEvent.click(screen.getByRole("button", { name: "Role for Vera Viewer: View" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "View" }));
    expect(changeRole).not.toHaveBeenCalled();
  });

  test("the Owner's row has a badge and no menus; your own row has the role but no Remove (leaving is in Settings)", () => {
    const { rerender } = render(<Row role="owner" />);
    expect(screen.getByText("Owner")).toBeDefined();
    expect(screen.queryAllByRole("button")).toEqual([]);

    rerender(<Row role="admin" isYou />);
    expect(screen.getByText("You")).toBeDefined();
    expect(screen.getByRole("button", { name: "Role for Vera Viewer: Admin" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Options for Vera Viewer" })).toBeNull();
  });

  test("Remove from group asks first, in a dialog where Cancel has the focus", async () => {
    const remove = removed();
    render(<Row remove={remove} />);
    const ask = () => {
      fireEvent.click(screen.getByRole("button", { name: "Options for Vera Viewer" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "Remove from group…" }));
      return within(screen.getByRole("dialog", { name: "Remove Vera Viewer?" }));
    };
    let dialog = ask();
    expect(dialog.getByText("They lose access to Cruz family straight away. To come back, they'll need a new invite.")).toBeDefined();
    expect(document.activeElement).toBe(dialog.getByRole("button", { name: "Cancel" }));
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(remove).not.toHaveBeenCalled();

    dialog = ask();
    await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Remove" })));
    expect(remove).toHaveBeenCalledOnce();
  });

  test("Invite people opens the form: an email, and the three roles with what each lets them do, View chosen", async () => {
    const invite = done({ token: "t".repeat(43), done: "Invite for ravi@example.com is ready. Share this link with them:" });
    render(<InviteButton action={invite} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite people" }));
    const form = within(screen.getByRole("form", { name: "Invite someone" }));
    expect(document.activeElement).toBe(form.getByRole("textbox", { name: "Email" }));
    expect(form.getAllByRole("radio").map((radio) => [(radio as HTMLInputElement).checked, radio.getAttribute("value")])).toEqual([
      [true, "view"],
      [false, "maintain"],
      [false, "admin"],
    ]);
    expect(form.getByRole("radio", { name: "Maintain", description: ROLE_HINTS.maintain })).toBeDefined();

    fireEvent.change(form.getByRole("textbox", { name: "Email" }), { target: { value: "ravi@example.com" } });
    fireEvent.click(form.getByRole("radio", { name: "Maintain" }));
    await act(async () => fireEvent.click(form.getByRole("button", { name: "Invite" })));
    const sent = invite.mock.calls[0][1];
    expect([sent.get("email"), sent.get("role")]).toEqual(["ravi@example.com", "maintain"]);
    expect(form.getByRole("status").textContent).toContain("Invite for ravi@example.com is ready.");
    expect((form.getByRole("textbox", { name: "New invite link" }) as HTMLInputElement).value).toMatch(/\/invite\/t{43}$/);
    fireEvent.click(form.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("invite links (an owner request, 2026-10-24)", () => {
  const link = { role: "view" as const, token: "t".repeat(43), createdBy: "Olivia Owner", expires: "31 Oct 2026", uses: 2, joined: ["Asha", "Ravi"] };

  test("Create a link: View or Maintain (no Admin), 7 days by default, a limit only when asked; then the /join/ link", async () => {
    const create = done({ token: "a".repeat(43), done: "Your link is ready. Share it with your family:" });
    render(<CreateLinkButton action={create} />);
    fireEvent.click(screen.getByRole("button", { name: "Create a link" }));
    const form = within(screen.getByRole("form", { name: "Create an invite link" }));
    expect(form.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["view", "maintain"]);
    expect((form.getByRole("radio", { name: "View" }) as HTMLInputElement).checked).toBe(true);
    const days = form.getByRole("combobox", { name: "Works for" }) as HTMLSelectElement;
    expect([...days.options].map((o) => o.textContent)).toEqual(["1 day", "7 days", "30 days"]);
    expect(days.value).toBe("7");
    expect(form.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(form.getByRole("checkbox", { name: "Limit the number of people" }));
    expect((form.getByRole("spinbutton", { name: "At most" }) as HTMLInputElement).value).toBe("20");

    await act(async () => fireEvent.submit(screen.getByRole("form", { name: "Create an invite link" })));
    const sent = create.mock.calls[0][1];
    expect([sent.get("role"), sent.get("days"), sent.get("limited"), sent.get("maxUses")]).toEqual(["view", "7", "on", "20"]);
    expect((screen.getByRole("textbox", { name: "New invite link" }) as HTMLInputElement).value).toMatch(new RegExp(`/join/${"a".repeat(43)}$`));
    expect(screen.getByRole("button", { name: "Done" })).toBeDefined();
  });

  test("a link's row: how many joined and who, Copy link; Share only where the browser has a share sheet", () => {
    const { unmount } = render(<ul><LinkRow link={link} revoke={removed()} /></ul>);
    expect(screen.getByText(/2 people joined · made by Olivia Owner · expires 31 Oct 2026/)).toBeDefined();
    expect(screen.getByText("Asha, Ravi")).toBeDefined();
    expect(screen.getByRole("button", { name: /Copy link/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Share/ })).toBeNull();
    unmount();

    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    try {
      render(<ul><LinkRow link={{ ...link, maxUses: 5 }} revoke={removed()} /></ul>);
      expect(screen.getByText(/2 of 5 joined/)).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Share View link" }));
      expect(share).toHaveBeenCalledWith({ title: "Join our family tree", url: `${window.location.origin}/join/${link.token}` });
    } finally {
      delete (navigator as { share?: unknown }).share;
    }
  });

  test("a used-up link says so and offers only Revoke, which asks first", async () => {
    const revoke = removed();
    render(<ul><LinkRow link={{ ...link, maxUses: 2 }} revoke={revoke} /></ul>);
    expect(screen.getByText("Used up")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Copy link/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Revoke View link" }));
    const dialog = within(screen.getByRole("dialog", { name: "Revoke this link?" }));
    expect(document.activeElement?.textContent).toBe("Cancel");
    await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Revoke" })));
    expect(revoke).toHaveBeenCalledOnce();
  });

  test("a member who joined by link is marked", () => {
    render(
      <ul>
        <MemberRow member={{ name: "Asha", email: "asha@example.com", role: "view", joined: "24 Oct 2026", byLink: true }} groupName="Cruz family" isYou={false} changeRole={done()} remove={removed()} />
      </ul>,
    );
    expect(screen.getByText("Joined by link")).toBeDefined();
  });
});

describe("Google photos (an owner request, 2026-10-25)", () => {
  const PHOTO = "https://lh3.googleusercontent.com/a/ACg8ocVera=s256-c";

  test("a member's and a requester's Google photo, in place of their initials; initials without one", () => {
    render(
      <ul>
        <MemberRow member={{ name: "Vera Viewer", email: "vera@example.com", photo: PHOTO, role: "view", joined: "18 Oct 2026" }} groupName="Cruz family" isYou={false} changeRole={done()} remove={removed()} />
        <RequestRow request={{ name: "Rita Requester", email: "rita@example.com", photo: PHOTO, date: "25 Oct 2026" }} decide={done()} />
        <MemberRow member={{ name: "Asha Kumar", email: "asha@example.com", role: "view", joined: "24 Oct 2026" }} groupName="Cruz family" isYou={false} changeRole={done()} remove={removed()} />
      </ul>,
    );
    const photos = [...document.querySelectorAll("img")];
    expect(photos.map((img) => img.getAttribute("src"))).toEqual([PHOTO, PHOTO]);
    expect(photos.every((img) => img.getAttribute("referrerpolicy") === "no-referrer" && img.alt === "")).toBe(true);
    expect(screen.queryByText("VV")).toBeNull();
    expect(screen.getByText("AK")).toBeDefined();
  });

  test("a photo that doesn't load gives way to the initials", () => {
    render(
      <ul>
        <MemberRow member={{ name: "Vera Viewer", email: "vera@example.com", photo: PHOTO, role: "view", joined: "18 Oct 2026" }} groupName="Cruz family" isYou={false} changeRole={done()} remove={removed()} />
      </ul>,
    );
    act(() => fireEvent.error(document.querySelector("img")!));
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("VV")).toBeDefined();
  });
});
