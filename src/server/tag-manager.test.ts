// @vitest-environment node
import { describe, expect, test } from "vitest";
import { gtmId } from "./tag-manager";

describe("gtmId: Google Tag Manager's container, from GTM_ID (owner request)", () => {
  test("a container ID; spaces around it are ignored", () => {
    expect(gtmId({ GTM_ID: "GTM-KZDLK4PQ" })).toBe("GTM-KZDLK4PQ");
    expect(gtmId({ GTM_ID: " GTM-KZDLK4PQ\n" })).toBe("GTM-KZDLK4PQ");
  });

  test("nothing when unset or empty: previews, local runs and tests (playwright.config.ts clears it)", () => {
    expect(gtmId({})).toBeUndefined();
    expect(gtmId({ GTM_ID: "" })).toBeUndefined();
    expect(gtmId({ GTM_ID: "  " })).toBeUndefined();
  });

  test("nothing for anything else, so no other text reaches the page's script", () => {
    for (const value of [
      "gtm-kzdlk4pq", // small letters
      "KZDLK4PQ", // no GTM-
      "GTM-",
      "G-ABC123DEF4", // a Google Analytics measurement ID, not a container
      "GTM-KZDLK4PQ GTM-OTHER",
      "GTM-KZDLK4PQ');alert(1);//",
      'GTM-X"</script><script>alert(1)</script>',
    ]) {
      expect(gtmId({ GTM_ID: value }), value).toBeUndefined();
    }
  });
});
