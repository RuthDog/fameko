import assert from "node:assert/strict";
import test from "node:test";

import {
  accountLinkConfirmationPage,
  accountLinkStartPage,
} from "./account-link-browser.ts";

const startContentSecurityPolicy =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://api.workos.com https://proactive-myth-55.authkit.app; base-uri 'none'; frame-ancestors 'none'";
const confirmationContentSecurityPolicy =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

test("account-link GET preserves the trusted Origin and permits only verified production redirects", async () => {
  const response = accountLinkStartPage(null);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin");
  assert.equal(
    response.headers.get("content-security-policy"),
    startContentSecurityPolicy,
  );
  assert.doesNotMatch(startContentSecurityPolicy, /\*/u);
  assert.doesNotMatch(startContentSecurityPolicy, /staging/u);

  const document = await response.text();
  assert.match(document, /<form action="\/account-link" method="post">/u);
  assert.match(document, /Behåll ditt befintliga Fameko-konto/u);
});

test("account-link confirmation GET preserves the trusted Origin and posts only to itself", async () => {
  const response = accountLinkConfirmationPage('state&<">');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin");
  assert.equal(
    response.headers.get("content-security-policy"),
    confirmationContentSecurityPolicy,
  );
  assert.doesNotMatch(confirmationContentSecurityPolicy, /api\.workos\.com|authkit\.app|\*/u);

  const document = await response.text();
  assert.match(
    document,
    /<form action="\/account-link\/confirm" method="post">/u,
  );
  assert.match(document, /value="state&amp;&lt;&quot;&gt;"/u);
});
