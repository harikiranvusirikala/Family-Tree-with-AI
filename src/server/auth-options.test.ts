// @vitest-environment node
import type { Db, MongoClient } from "mongodb";
import type { Account, GenericEndpointContext } from "better-auth";
import { expect, test, vi } from "vitest";
import { authOptions, pictureFromIdToken, refreshGooglePhoto } from "./auth-options";

test("Google's tokens are stored encrypted (step 11's review)", () => {
  const options = authOptions({ db: {} as Db, client: {} as MongoClient }, { BETTER_AUTH_URL: "http://localhost:3000" });
  expect(options.account).toEqual({ encryptOAuthTokens: true });
});

// A Google ID token's shape: header.payload.signature, each base64url (the signature isn't checked).
const idToken = (claims: object) => ["{}", JSON.stringify(claims), "signature"].map((part) => Buffer.from(part).toString("base64url")).join(".");
const PHOTO = "https://lh3.googleusercontent.com/a/ACg8ocNewPhoto=s96-c";

test("the picture in a Google ID token", () => {
  expect(pictureFromIdToken(idToken({ sub: "1", name: "Asha", picture: PHOTO }))).toBe(PHOTO);
  for (const token of [null, undefined, "", "not-a-token", idToken({ sub: "1" }), idToken({ picture: 7 }), idToken({ picture: "javascript:alert(1)" }), "a.%%%.c"]) {
    expect(pictureFromIdToken(token)).toBeNull();
  }
});

test("each sign-in copies Google's current photo to the user, and only the photo (owner request)", async () => {
  const updateUser = vi.fn(async () => null);
  const context = { context: { internalAdapter: { updateUser } } } as unknown as GenericEndpointContext;
  const account = { id: "a1", userId: "u1", providerId: "google", accountId: "g1", idToken: idToken({ name: "Someone Else", picture: PHOTO }) } as Account;
  expect(authOptions({ db: {} as Db, client: {} as MongoClient }, { BETTER_AUTH_URL: "http://localhost:3000" }).databaseHooks.account.update.after).toBe(refreshGooglePhoto);

  await refreshGooglePhoto(account, context);
  expect(updateUser).toHaveBeenCalledExactlyOnceWith("u1", { image: PHOTO });

  // Nothing for another provider, a token without a picture, or an update outside a request.
  updateUser.mockClear();
  await refreshGooglePhoto({ ...account, providerId: "github" }, context);
  await refreshGooglePhoto({ ...account, idToken: undefined }, context);
  await refreshGooglePhoto(account, null);
  expect(updateUser).not.toHaveBeenCalled();

  // A failed write is logged, and the sign-in goes on.
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  updateUser.mockRejectedValueOnce(new Error("down"));
  await expect(refreshGooglePhoto(account, context)).resolves.toBeUndefined();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});
