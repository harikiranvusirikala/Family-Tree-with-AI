// @vitest-environment node
import { describe, expect, it } from "vitest";
import { googlePhotoUrl } from "./google-photo";

describe("googlePhotoUrl", () => {
  it("asks Google for a bigger square photo", () => {
    expect(googlePhotoUrl("https://lh3.googleusercontent.com/a/ACg8ocKx1Y2z=s96-c")).toBe("https://lh3.googleusercontent.com/a/ACg8ocKx1Y2z=s256-c");
    expect(googlePhotoUrl("https://lh3.googleusercontent.com/a/ACg8ocKx1Y2z=s96", 128)).toBe("https://lh3.googleusercontent.com/a/ACg8ocKx1Y2z=s128-c");
  });

  it("adds a size to an address without one, and leaves other options alone", () => {
    expect(googlePhotoUrl("https://lh5.googleusercontent.com/a/ACg8ocKx1Y2z")).toBe("https://lh5.googleusercontent.com/a/ACg8ocKx1Y2z=s256-c");
    expect(googlePhotoUrl("https://lh3.googleusercontent.com/a/ACg8oc=w96-h96-p")).toBe("https://lh3.googleusercontent.com/a/ACg8oc=w96-h96-p");
  });

  it("refuses anything that isn't a Google photo over https", () => {
    for (const image of [null, undefined, "", "not a url", "http://lh3.googleusercontent.com/a/x=s96-c", "https://example.com/a/x=s96-c", "https://googleusercontent.com.evil.example/a=s96-c", "javascript:alert(1)"]) {
      expect(googlePhotoUrl(image)).toBeNull();
    }
  });
});
