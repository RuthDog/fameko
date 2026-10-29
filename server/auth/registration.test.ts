import assert from "node:assert/strict";
import test from "node:test";

import {
  adultRegistrationAttestation,
  mayProvisionWorkosIdentity,
} from "./registration.ts";

test("new WorkOS account requires the adult attestation bound into callback state", () => {
  assert.equal(mayProvisionWorkosIdentity(false, adultRegistrationAttestation), true);
  assert.equal(mayProvisionWorkosIdentity(false, undefined), false);
  assert.equal(mayProvisionWorkosIdentity(false, "other-state"), false);
});

test("an existing WorkOS identity can sign in without repeating registration attestation", () => {
  assert.equal(mayProvisionWorkosIdentity(true, undefined), true);
});
