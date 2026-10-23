import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PersonPhoto } from "./PersonPhoto";
import { CloudNameContext, PhotosHiddenContext, photoUrl, wholePhotoUrl } from "./photo";

afterEach(cleanup);

const jake = { name: "Jake Cruz", gender: "male" as const, photoId: "groups/65f0c0ffee0000000000abcd/jake-photo-1" };

describe("photos on cards and panels", () => {
  test("a face-cropped square at twice the card's size, in the best format", () => {
    expect(photoUrl("demo", jake.photoId)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_thumb,g_face,w_168,h_168/f_auto,q_auto/groups/65f0c0ffee0000000000abcd/jake-photo-1",
    );
  });

  test("with a rectangle around the person (an owner request), the face is looked for only inside it", () => {
    const crop = { x: 0, y: 0.25, w: 1, h: 0.5 };
    expect(photoUrl("demo", jake.photoId, crop)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_crop,x_0.0000,y_0.2500,w_1.0000,h_0.5000/c_thumb,g_face,w_168,h_168/f_auto,q_auto/groups/65f0c0ffee0000000000abcd/jake-photo-1",
    );
    const { container } = render(
      <CloudNameContext value="demo">
        <PersonPhoto person={{ ...jake, photoCrop: crop }} size={84} />
      </CloudNameContext>,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(photoUrl("demo", jake.photoId, crop));
  });

  test("the whole photo, for choosing where someone is in it", () => {
    expect(wholePhotoUrl("demo", jake.photoId, 1200)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,h_1200/f_auto,q_auto/groups/65f0c0ffee0000000000abcd/jake-photo-1",
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
