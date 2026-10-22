import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

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

test("landing page starts with Google Tag Manager, only with a valid GTM_ID (owner request)", () => {
  // Drawn on the server, as the build does: the landing page is prerendered with the build's GTM_ID.
  vi.stubEnv("GTM_ID", undefined);
  expect(renderToStaticMarkup(<Home />)).not.toContain("googletagmanager");
  vi.stubEnv("GTM_ID", "GTM-bad id");
  expect(renderToStaticMarkup(<Home />)).not.toContain("googletagmanager");

  vi.stubEnv("GTM_ID", "GTM-KZDLK4PQ");
  const html = renderToStaticMarkup(<Home />);
  expect(html).toMatch(
    /^<script>if\(!new URLSearchParams\(location\.search\)\.has\('returnTo'\)\)\n\(function\(w,d,s,l,i\)[^<]*'dataLayer',"GTM-KZDLK4PQ"\);<\/script><noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-KZDLK4PQ"/,
  );
  expect(html.indexOf("<main")).toBeGreaterThan(html.indexOf("</noscript>"));
});
