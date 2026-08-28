import assert from "node:assert/strict";
import test from "node:test";

import type { AccessClaims } from "../access-token.ts";
import { PilotDirectoryError, resolvePilotIdentity } from "./pilot-directory.ts";

const now = "2026-08-28T12:00:00.000Z";
const claims: AccessClaims = {
  aud: "audience",
  email: "pilot@example.com",
  exp: 2_000_000_000,
  iat: 1_900_000_000,
  iss: "https://fameko.cloudflareaccess.com",
  nbf: 1_900_000_000,
  sub: "access-subject",
  type: "app",
};

function directory(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    auth_identities: [
      {
        created_at: now,
        email_snapshot: "pilot@example.com",
        provider: "cloudflare_access",
        subject: "access-subject",
        user_id: "user-id",
      },
    ],
    household_members: [
      {
        created_at: now,
        household_id: "household-id",
        role: "owner",
        user_id: "user-id",
      },
    ],
    households: [
      { created_at: now, id: "household-id", name: "Mitt hushåll", updated_at: now },
    ],
    users: [
      {
        created_at: now,
        email_normalized: "pilot@example.com",
        id: "user-id",
        status: "active",
        updated_at: now,
      },
    ],
    ...overrides,
  });
}

test("resolves Access identity through User and membership to Household", () => {
  const context = resolvePilotIdentity(claims, directory());
  assert.equal(context.user.id, "user-id");
  assert.equal(context.membership.role, "owner");
  assert.equal(context.household.id, "household-id");
});

test("rejects an unknown Access subject", () => {
  assert.throws(
    () => resolvePilotIdentity({ ...claims, sub: "unknown" }, directory()),
    (error) => error instanceof PilotDirectoryError && error.code === "user_missing",
  );
});

test("rejects a disabled pilot user", () => {
  const users = [
    {
      created_at: now,
      email_normalized: "pilot@example.com",
      id: "user-id",
      status: "disabled",
      updated_at: now,
    },
  ];

  assert.throws(
    () => resolvePilotIdentity(claims, directory({ users })),
    (error) => error instanceof PilotDirectoryError && error.code === "user_disabled",
  );
});

test("rejects a user without a household membership", () => {
  assert.throws(
    () => resolvePilotIdentity(claims, directory({ household_members: [] })),
    (error) => error instanceof PilotDirectoryError && error.code === "household_missing",
  );
});
