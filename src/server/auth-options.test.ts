// @vitest-environment node
import type { Db, MongoClient } from "mongodb";
import { expect, test } from "vitest";
import { authOptions } from "./auth-options";

test("Google's tokens are stored encrypted (step 11's review)", () => {
  const options = authOptions({ db: {} as Db, client: {} as MongoClient }, { BETTER_AUTH_URL: "http://localhost:3000" });
  expect(options.account).toEqual({ encryptOAuthTokens: true });
});
