import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PersonPhoto } from "./PersonPhoto";
import { CloudNameContext, PhotosHiddenContext, photoUrl } from "./photo";

afterEach(cleanup);

const jake = { name: "Jake Cruz", gender: "male" as const, photoId: "groups/65f0c0ffee0000000000abcd/jake-photo-1" };

describe("photos on cards and panels", () => {
  test("a face-cropped square at twice the card's size, in the best format", () => {
    expect(photoUrl("demo", jake.photoId)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_thumb,g_face,w_168,h_168/f_auto,q_auto/groups/65f0c0ffee0000000000abcd/jake-photo-1",
    );
  });

  test("the photo when there is one, initials otherwise", () => {
    const { container } = render(
      <CloudNameContext value="demo">
        <PersonPhoto person={jake} size={84} />
        <PersonPhoto person={{ name: "Taylor Humes", gender: "female" }} size={84} />
      </CloudNameContext>,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(photoUrl("demo", jake.photoId));
    expect(screen.getByText("TH")).toBeDefined();
  });

  test("initials when photos aren't set up, or the photo doesn't load", () => {
    const { container, rerender } = render(<PersonPhoto person={jake} size={84} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("JC")).toBeDefined();

    rerender(
      <CloudNameContext value="demo">
        <PersonPhoto person={jake} size={84} />
      </CloudNameContext>,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("JC")).toBeDefined();
  });

  test("initials while the eye button hides photos, and the photo again when it doesn't", () => {
    const tree = (hidden: boolean) => (
      <CloudNameContext value="demo">
        <PhotosHiddenContext value={hidden}>
          <PersonPhoto person={jake} size={84} />
        </PhotosHiddenContext>
      </CloudNameContext>
    );
    const { container, rerender } = render(tree(true));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("JC")).toBeDefined();
    rerender(tree(false));
    expect(container.querySelector("img")?.getAttribute("src")).toBe(photoUrl("demo", jake.photoId));
  });
});
