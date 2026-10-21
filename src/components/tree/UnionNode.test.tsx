import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { CanvasActionsContext } from "./canvas-actions";
import { UnionNode, type UnionNodeType } from "./UnionNode";

afterEach(cleanup);

/** Steve and Arham's heart, married on 8 Sep 2008 unless `married` says otherwise, with someone selected. */
function heart({ selectedId, married = { marriageYear: 2008, marriageMonth: 9, marriageDay: 8 }, couple = true }: { selectedId?: string; married?: UnionNodeType["data"]["married"]; couple?: boolean } = {}) {
  const props = { id: "steve-arham", data: { couple, divorced: false, label: "Steve Cruz and Arham Chopra", partnerIds: ["steve", "arham"], married } } as NodeProps<UnionNodeType>;
  render(
    <ReactFlowProvider>
      <CanvasActionsContext.Provider value={{ selectedId, onCouple: () => {} }}>
        <UnionNode {...props} />
      </CanvasActionsContext.Provider>
    </ReactFlowProvider>,
  );
  return screen.queryByTestId("marriage-date")?.textContent ?? null;
}

describe("the marriage date above the heart (owner request)", () => {
  test("the year; the full date while the heart or either partner is selected", () => {
    expect(heart()).toBe("2008");
    cleanup();
    expect(heart({ selectedId: "someone-else" })).toBe("2008");
    cleanup();
    expect(heart({ selectedId: "steve" })).toBe("8 Sep 2008");
    cleanup();
    expect(heart({ selectedId: "arham" })).toBe("8 Sep 2008");
    cleanup();
    expect(heart({ selectedId: "steve-arham" })).toBe("8 Sep 2008");
  });

  test("the button keeps its name; nothing without a date, or for a single parent", () => {
    heart();
    expect(screen.getByRole("button", { name: "Steve Cruz and Arham Chopra, married" })).toBeDefined();
    cleanup();
    expect(heart({ married: {}, selectedId: "steve" })).toBeNull();
    cleanup();
    expect(heart({ couple: false })).toBeNull();
    cleanup();
    expect(heart({ married: { marriageYear: 2008 }, selectedId: "steve" })).toBe("2008");
  });
});
