import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

test("landing page shows the app name and the sign-in button", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "Family Tree" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeDefined();
});
