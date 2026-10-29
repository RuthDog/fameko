import assert from "node:assert/strict";
import test from "node:test";

import { verifiedAuthContextFromWorkosUser } from "./workos-auth-context.ts";

test("verified WorkOS user maps to provider subject without using email as identity", () => {
  assert.deepEqual(
    verifiedAuthContextFromWorkosUser({
      email: " Adult@Example.SE ",
      emailVerified: true,
      id: " user_01 ",
    }),
    {
      provider: "workos",
      providerSubject: "user_01",
      verifiedEmail: "adult@example.se",
    },
  );
});

test("unverified WorkOS email is rejected", () => {
  assert.throws(() =>
    verifiedAuthContextFromWorkosUser({
      email: "adult@example.se",
      emailVerified: false,
      id: "user_01",
    }),
  );
});
