import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";

import { provisionPilotIdentity } from "../identity/provision-pilot.ts";
import { authorizeRequest } from "./authorize-request.ts";

const issuer = "https://fameko-authorize-test.cloudflareaccess.com";
const audience = "authorize-test-audience";
const kid = "authorize-test-key";
const migrationUrl = new URL("../../migrations/0001_identity_foundation.sql", import.meta.url);

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString("base64url");
}

async function createToken(privateKey: CryptoKey, subject: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: audience,
      email: "authorized@example.test",
      exp: now + 600,
      iat: now - 10,
      iss: issuer,
      nbf: now - 10,
      sub: subject,
      type: "app",
    }),
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

test("authorize-request uses verified Access identity and D1 as one fail-closed chain", async () => {
  const miniflare = new Miniflare({
    d1Databases: { FAMEKO_DB: "fameko-authorize-test" },
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
  });
  const database = await miniflare.getD1Database("FAMEKO_DB");
  const migration = await readFile(migrationUrl, "utf8");
  await database.batch(
    unstable_splitSqlQuery(migration)
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement)),
  );
  const provisioned = await provisionPilotIdentity(database, {
    email: "authorized@example.test",
    providerSubject: "known-subject",
  });
  const pair = await crypto.subtle.generateKey(
    {
      hash: "SHA-256",
      modulusLength: 2048,
      name: "RSASSA-PKCS1-v1_5",
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ keys: [{ ...publicJwk, kid }] }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  const environment = {
    CF_ACCESS_AUD: audience,
    CF_ACCESS_TEAM_DOMAIN: issuer,
  };

  try {
    const knownToken = await createToken(pair.privateKey, "known-subject");
    const authorized = await authorizeRequest(
      new Request("https://fameko.se/app", {
        headers: { "Cf-Access-Jwt-Assertion": knownToken },
      }),
      { database, environment },
    );
    assert.equal(authorized.ok, true);
    if (authorized.ok) {
      assert.equal(authorized.context.user.id, provisioned.userId);
      assert.equal(authorized.context.household.id, provisioned.householdId);
    }

    const unknownToken = await createToken(pair.privateKey, "unknown-subject");
    const unknown = await authorizeRequest(
      new Request("https://fameko.se/app", {
        headers: { "Cf-Access-Jwt-Assertion": unknownToken },
      }),
      { database, environment },
    );
    assert.deepEqual(unknown, { code: "identity_missing", ok: false });

    const unavailableDatabase = {
      prepare() {
        throw new Error("D1 unavailable");
      },
    } as unknown as D1Database;
    const unavailable = await authorizeRequest(
      new Request("https://fameko.se/app", {
        headers: { "Cf-Access-Jwt-Assertion": knownToken },
      }),
      { database: unavailableDatabase, environment },
    );
    assert.deepEqual(unavailable, { code: "database_unavailable", ok: false });
  } finally {
    globalThis.fetch = originalFetch;
    await miniflare.dispose();
  }
});
