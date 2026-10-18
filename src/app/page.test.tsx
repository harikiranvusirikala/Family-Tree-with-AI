import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

test("landing page shows the app name", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "Family Tree" })).toBeDefined();
});
