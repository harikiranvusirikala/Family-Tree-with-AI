import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AppHeader, type GroupNav } from "./AppHeader";

// The account menu asks Better Auth for the session; here the page's user is enough.
vi.mock("./auth/auth-client", () => ({ authClient: { useSession: () => ({ data: null }), signOut: vi.fn() } }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

const user = { name: "Carla Cruz", email: "carla.cruz@example.com" };
const nav = (overrides: Partial<GroupNav> = {}): GroupNav => ({
  id: "a".repeat(24),
  name: "Cruz family",
  groups: [
    { id: "a".repeat(24), name: "Cruz family" },
    { id: "b".repeat(24), name: "Young family" },
  ],
  active: "tree",
  members: { waiting: 0 },
  ...overrides,
});
const banner = () => within(screen.getByRole("banner"));

describe("the app's header (the production look)", () => {
  test("the app's icon and name go to the dashboard; a page without a group shows nothing else", () => {
    render(<AppHeader user={user} />);
    expect(banner().getByRole("link", { name: "Family Tree" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(banner().getByRole("button", { name: "Carla Cruz" })).toBeDefined();
  });

  test("a group's pages are tabs, the open one marked; Members only for those who manage them", () => {
    const { rerender } = render(<AppHeader user={user} nav={nav({ active: "members", members: { waiting: 2 } })} />);
    const tabs = within(screen.getByRole("navigation", { name: "This family tree" }));
    expect(tabs.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([`/g/${"a".repeat(24)}`, `/g/${"a".repeat(24)}/members`, `/g/${"a".repeat(24)}/settings`]);
    const members = tabs.getByRole("link", { name: "Members, 2 access requests" });
    expect(members.getAttribute("aria-current")).toBe("page");
    expect(tabs.getByRole("link", { name: "Tree" }).getAttribute("aria-current")).toBeNull();

    rerender(<AppHeader user={user} nav={nav({ active: "settings", members: null })} />);
    expect(screen.getByRole("navigation").textContent).not.toContain("Members");
    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
  });

  test("the group's name opens the user's groups, the open one ticked, and all of them on the dashboard", () => {
    render(<AppHeader user={user} nav={nav()} />);
    fireEvent.click(banner().getByRole("button", { name: "Cruz family" }));
    const menu = within(screen.getByRole("menu", { name: "Your groups" }));
    expect(menu.getByRole("menuitemradio", { name: "Cruz family" }).getAttribute("aria-checked")).toBe("true");
    expect(menu.getByRole("menuitemradio", { name: "Young family" }).getAttribute("href")).toBe(`/g/${"b".repeat(24)}`);
    expect(menu.getByRole("menuitem", { name: "All groups" }).getAttribute("href")).toBe("/dashboard");
  });

  test("the theme is one button: Day, Night or Follow device, the choice ticked and remembered", () => {
    render(<AppHeader user={user} nav={nav()} />);
    fireEvent.click(banner().getByRole("button", { name: "Theme" }));
    const menu = within(screen.getByRole("menu", { name: "Theme" }));
    expect(menu.getAllByRole("menuitemradio").map((item) => [item.textContent, item.getAttribute("aria-checked")])).toEqual([
      ["Day", "false"],
      ["Night", "false"],
      ["Follow device", "true"],
    ]);
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Night" }));
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("on phones the account menu holds the group's pages (with the requests' count) and the theme", () => {
    render(<AppHeader user={user} nav={nav({ members: { waiting: 1 } })} />);
    fireEvent.click(banner().getByRole("button", { name: "Carla Cruz" }));
    const menu = within(screen.getByRole("menu", { name: "Account" }));
    expect(menu.getByText("carla.cruz@example.com")).toBeDefined();
    expect(menu.getAllByRole("menuitem").map((item) => item.getAttribute("aria-label") ?? item.textContent)).toEqual([
      "Tree",
      "Members, 1 access request",
      "Settings",
      "Buy me a coffee (opens in a new tab)",
      "Sign out",
    ]);
    expect(menu.getByRole("group", { name: "Theme" })).toBeDefined();
  });
});
