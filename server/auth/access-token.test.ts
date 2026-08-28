import assert from "node:assert/strict";
import test from "node:test";

import { AccessTokenError, verifyAccessToken } from "./access-token.ts";

const issuer = "https://fameko-test.cloudflareaccess.com";
const audience = "test-access-audience";
const kid = "test-key";

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString("base64url");
}

async function createToken(
  privateKey: CryptoKey,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: audience,
      email: "pilot@example.com",
      exp: now + 600,
      iat: now - 10,
      iss: issuer,
      nbf: now - 10,
      sub: "access-subject",
      type: "app",
      ...overrides,
    }),
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  return `${header}.${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

test("verifies a valid Cloudflare Access application token", async () => {
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

  try {
    const token = await createToken(pair.privateKey);
    const claims = await verifyAccessToken(token, issuer, audience);
    assert.equal(claims.sub, "access-subject");
    assert.equal(claims.email, "pilot@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an Access token for another application", async () => {
  const secondIssuer = "https://fameko-test-2.cloudflareaccess.com";
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
  const token = await createToken(pair.privateKey, {
    aud: "another-application",
    iss: secondIssuer,
  });

  try {
    await assert.rejects(
      verifyAccessToken(token, secondIssuer, audience),
      AccessTokenError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
