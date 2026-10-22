import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Home from "./page";

afterEach(cleanup);

test("landing page shows the app name and the sign-in button", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "Family Tree" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeDefined();
});

test("landing page links to Buy Me a Coffee in a new tab", () => {
  render(<Home />);
  const link = screen.getByRole("link", { name: "Buy me a coffee (opens in a new tab)" });
  expect(link.getAttribute("href")).toBe("https://buymeacoffee.com/harikiranvusirikala");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});
