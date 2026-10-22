import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { DESCRIPTION, FAQ, structuredData } from "@/components/landing/content";
import type { AuthUrlEnv } from "@/server/auth-urls";
import { siteUrl } from "@/server/site";
import Home, { metadata } from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

test("landing page says what the app is, with two ways to sign in with Google", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "Build your family tree together, with an AI assistant" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDefined();
});

test("landing page links to Buy Me a Coffee, the source code and its license, each in a new tab", () => {
  render(<Home />);
  const links = [
    ["Buy me a coffee (opens in a new tab)", "https://buymeacoffee.com/harikiranvusirikala"],
    ["Source code on GitHub (opens in a new tab)", "https://github.com/harikiranvusirikala/Family-Tree-with-AI"],
    ["MIT license (opens in a new tab)", "https://github.com/harikiranvusirikala/Family-Tree-with-AI/blob/main/LICENSE"],
  ];
  for (const [name, href] of links) {
    const link = screen.getByRole("link", { name });
    expect(link.getAttribute("href")).toBe(href);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  }
});

test("every question is on the page with its answer, as the structured data tells search engines", () => {
  const { container } = render(<Home />);
  for (const { question, answer } of FAQ) {
    expect(screen.getByRole("heading", { level: 3, name: question })).toBeDefined();
    expect(screen.getByText(answer)).toBeDefined();
  }
  const script = container.querySelector('script[type="application/ld+json"]')!;
  expect(JSON.parse(script.textContent!)).toEqual(structuredData(siteUrl(process.env as AuthUrlEnv)));
});

test("search engines get a title, a description short enough to show whole, one address and Google's check", () => {
  expect(metadata.title).toBe("Family Tree with AI: build your family tree together");
  expect(metadata.description).toBe(DESCRIPTION);
  expect(DESCRIPTION.length).toBeLessThanOrEqual(160);
  expect(metadata.alternates?.canonical).toBe("/");
  expect(metadata.verification?.google).toBe("iS4OF4-2DT8drLIM-FZU8JA8b-ALGsTFZEbWyQEoj8Y");
  expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
});

test("landing page starts with Google Tag Manager, only with a valid GTM_ID (owner request)", () => {
  // Drawn on the server, as the build does: the landing page is prerendered with the build's GTM_ID.
  vi.stubEnv("GTM_ID", undefined);
  expect(renderToStaticMarkup(<Home />)).not.toContain("googletagmanager");
  vi.stubEnv("GTM_ID", "GTM-bad id");
  expect(renderToStaticMarkup(<Home />)).not.toContain("googletagmanager");

  vi.stubEnv("GTM_ID", "GTM-KZDLK4PQ");
  // React puts the hero picture's preload link first here; in the page it goes in <head>.
  const html = renderToStaticMarkup(<Home />).replace(/^(<link [^>]*\/>)+/, "");
  expect(html).toMatch(
    /^<script>if\(!new URLSearchParams\(location\.search\)\.has\('returnTo'\)\)\n\(function\(w,d,s,l,i\)[^<]*'dataLayer',"GTM-KZDLK4PQ"\);<\/script><noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-KZDLK4PQ"/,
  );
  expect(html.indexOf("<main")).toBeGreaterThan(html.indexOf("</noscript>"));
});
