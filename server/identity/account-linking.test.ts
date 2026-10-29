import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountLinkingError,
  prepareAccountLinkPlan,
  type VerifiedAccountLinkGrant,
} from "./account-linking.ts";

const source = {
  provider: "cloudflare_access",
  providerSubject: "pilot-subject",
  verifiedEmail: "same@example.test",
};
const target = {
  provider: "workos",
  providerSubject: "workos-user",
  verifiedEmail: "same@example.test",
};
const grant: VerifiedAccountLinkGrant = {
  consumedAt: null,
  existingUserId: "internal-user-id",
  expiresAt: "2030-01-01T00:00:00.000Z",
  id: "one-time-grant-id",
  sourceProvider: source.provider,
  sourceProviderSubject: source.providerSubject,
  targetProvider: target.provider,
  targetProviderSubject: target.providerSubject,
};

test("pilot linking preserves the internal user only with an exact one-time subject grant", () => {
  assert.deepEqual(
    prepareAccountLinkPlan(grant, source, target, new Date("2029-01-01T00:00:00.000Z")),
    {
      grantId: grant.id,
      provider: "workos",
      providerSubject: "workos-user",
      userId: "internal-user-id",
    },
  );
});

test("matching email alone cannot authorize pilot linking", () => {
  assert.throws(
    () =>
      prepareAccountLinkPlan(
        { ...grant, targetProviderSubject: "different-workos-user" },
        source,
        target,
        new Date("2029-01-01T00:00:00.000Z"),
      ),
    AccountLinkingError,
  );
});

test("consumed or expired pilot grants fail closed", () => {
  assert.throws(
    () =>
      prepareAccountLinkPlan(
        { ...grant, consumedAt: "2028-01-01T00:00:00.000Z" },
        source,
        target,
        new Date("2029-01-01T00:00:00.000Z"),
      ),
    AccountLinkingError,
  );
  assert.throws(
    () => prepareAccountLinkPlan(grant, source, target, new Date("2031-01-01T00:00:00.000Z")),
    AccountLinkingError,
  );
});
