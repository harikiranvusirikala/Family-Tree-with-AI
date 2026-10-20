// @vitest-environment node
// Every server action and route handler checks who's calling (§8, step 11's review): server actions
// can be called directly, and src/proxy.ts only looks for a cookie. So a new one can't forget.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const CHECKS = new Set(["requireUser", "requireRole", "getUser"]);
const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
/** Better Auth's own endpoints (sign-in, the Google callback, sessions), which it checks itself. */
const NOT_OURS = ["src/app/api/auth/[...all]/route.ts"];

const sourceFiles = (folder: string) =>
  readdirSync(folder, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(folder, file));
const isServerActionFile = (text: string) => /^\s*["']use server["']/.test(text);

/**
 * The file's exported functions (for a route file, its HTTP methods), and whether each calls a check,
 * directly or through a function in the same file (like the members page's `attempt`). An export
 * that isn't a function there counts as unchecked.
 */
function exportedChecks(path: string, text: string, onlyHttpMethods = false): { name: string; checks: boolean }[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const functions = new Map<string, ts.Node>();
  const exported: string[] = [];
  const isExported = (node: ts.Node) => ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      functions.set(statement.name.text, statement);
      if (isExported(statement)) exported.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const names = ts.isIdentifier(declaration.name)
          ? [declaration.name.text]
          : ts.isObjectBindingPattern(declaration.name)
            ? declaration.name.elements.map((e) => e.name.getText(source))
            : [];
        const init = declaration.initializer;
        if (names.length === 1 && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) functions.set(names[0], init);
        if (isExported(statement)) exported.push(...names);
      }
    }
  }
  const callees = (node: ts.Node): string[] => {
    const found: string[] = [];
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) found.push(n.expression.text);
      ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  };
  const checks = (name: string, seen: Set<string>): boolean => {
    const fn = functions.get(name);
    if (!fn || seen.has(name)) return false;
    seen.add(name);
    return callees(fn).some((callee) => CHECKS.has(callee) || checks(callee, seen));
  };
  return exported.filter((name) => !onlyHttpMethods || HTTP_METHODS.has(name)).map((name) => ({ name, checks: checks(name, new Set()) }));
}

const unchecked = (files: string[], onlyHttpMethods: boolean) =>
  files.flatMap((file) =>
    exportedChecks(file, readFileSync(file, "utf8"), onlyHttpMethods)
      .filter((fn) => !fn.checks)
      .map((fn) => `${file}: ${fn.name}`),
  );

describe("every server action and route handler checks who's calling", () => {
  const files = sourceFiles("src");
  const actionFiles = files.filter((file) => isServerActionFile(readFileSync(file, "utf8")));
  const routeFiles = files.filter((file) => file.startsWith(join("src", "app")) && /[/\\]route\.ts$/.test(file) && !NOT_OURS.includes(file));

  test("server actions: requireUser or requireRole", () => {
    expect(actionFiles.flatMap((file) => exportedChecks(file, readFileSync(file, "utf8"))).length).toBeGreaterThanOrEqual(16);
    expect(unchecked(actionFiles, false)).toEqual([]);
  });

  test("route handlers: getUser", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(2);
    expect(unchecked(routeFiles, true)).toEqual([]);
  });

  test("no server actions hidden inside components, where this check wouldn't see them", () => {
    const inline = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return (text.match(/["']use server["']/g)?.length ?? 0) > (isServerActionFile(text) ? 1 : 0);
    });
    expect(inline).toEqual([]);
  });

  test("the check itself: through a helper counts, a missing check or a re-exported handler doesn't", () => {
    const text = `"use server";
      async function attempt(work) { const user = await requireUser(); return work(user); }
      export async function viaHelper(id) { return attempt(() => load(id)); }
      export const arrow = async () => { await requireRole("g", "view"); };
      export async function forgot(id) { return load(id); }
      export const { GET, POST } = handlers;`;
    expect(exportedChecks("actions.ts", text)).toEqual([
      { name: "viaHelper", checks: true },
      { name: "arrow", checks: true },
      { name: "forgot", checks: false },
      { name: "GET", checks: false },
      { name: "POST", checks: false },
    ]);
  });
});
