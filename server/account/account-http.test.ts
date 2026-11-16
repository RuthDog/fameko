import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { needsAccountDeleteReauthentication } from "./account-delete-auth.ts";
import { startAccountDeleteReauthentication } from "./account-delete-reauth.ts";
import { isSameOriginAccountJsonRequest } from "./account-http.ts";

const publicOrigin = "https://auth-staging.example.test";

function accountRequest(headers: Record<string, string>, method = "POST") {
  return new Request(`${publicOrigin}/app/api/account/export`, { headers, method });
}

test("account JSON mutations require exact configured Origin and JSON", () => {
  assert.equal(
    isSameOriginAccountJsonRequest(
      accountRequest({
        "Content-Type": "application/json; charset=utf-8",
        Origin: publicOrigin,
        "Sec-Fetch-Site": "same-origin",
      }),
      publicOrigin,
    ),
    true,
  );
  for (const candidate of [
    accountRequest({ "Content-Type": "application/json", Origin: "https://evil.example", "Sec-Fetch-Site": "same-origin" }),
    accountRequest({ "Content-Type": "application/json", Origin: publicOrigin, "Sec-Fetch-Site": "cross-site" }),
    accountRequest({ "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }),
    accountRequest({ "Content-Type": "text/plain", Origin: publicOrigin, "Sec-Fetch-Site": "same-origin" }),
    accountRequest({ "Content-Type": "application/json", Origin: publicOrigin }, "GET"),
  ]) {
    assert.equal(isSameOriginAccountJsonRequest(candidate, publicOrigin), false);
  }
});

test("account routes enforce server identity, no-store, fresh auth and explicit deletion", async () => {
  const [exportRoute, deleteRoute, deletePage, reauthRoute, accountMenu] = await Promise.all([
    readFile(new URL("../../app/app/api/account/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/app/api/account/delete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/app/account/delete/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/auth/reauth/account-delete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/app/account-menu.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(exportRoute, /authorization\.context/);
  assert.match(exportRoute, /allowWithoutCurrentTerms:\s*true/);
  assert.match(exportRoute, /Content-Disposition/);
  assert.match(exportRoute, /private, no-store/);
  assert.match(deleteRoute, /allowWithoutCurrentTerms:\s*true/);
  assert.match(deleteRoute, /checkRecentAuth\(\{ maxAge: 300 \}\)/);
  assert.match(deleteRoute, /RADERA MITT KONTO/);
  assert.match(deleteRoute, /listActiveSessionIds/);
  assert.match(deleteRoute, /revokeSession/);
  assert.match(deleteRoute, /deleteUser/);
  assert.ok(
    deleteRoute.indexOf("if (recent.isStale)")
      < deleteRoute.indexOf("requestAccountDeletion("),
  );
  assert.match(deletePage, /needsAccountDeleteReauthentication\(checkRecentAuth\)/);
  assert.match(deletePage, /href="\/auth\/reauth\/account-delete"/);
  assert.doesNotMatch(deletePage, /getSignInUrl|redirect\(/);
  assert.match(reauthRoute, /startAccountDeleteReauthentication\(request, getSignInUrl\)/);
  assert.match(accountMenu, /Exportera mina uppgifter/);
  assert.match(accountMenu, /Radera mitt konto/);
});

test("account deletion page fails closed for stale, missing and unavailable auth time", async () => {
  let maxAge = 0;
  assert.equal(
    await needsAccountDeleteReauthentication(async (options) => {
      maxAge = options.maxAge;
      return { isStale: false };
    }),
    false,
  );
  assert.equal(maxAge, 300);

  assert.equal(
    await needsAccountDeleteReauthentication(async () => ({ isStale: true })),
    true,
  );
  assert.equal(
    await needsAccountDeleteReauthentication(async () => ({
      authenticatedAt: null,
      isStale: true,
    })),
    true,
  );
  assert.equal(
    await needsAccountDeleteReauthentication(async () => {
      throw new Error("synthetic missing session");
    }),
    true,
  );
});

test("account deletion reauthentication has a fixed recent-auth return path", async () => {
  let receivedOptions: { maxAge: number; returnTo: string } | undefined;
  const response = await startAccountDeleteReauthentication(
    new Request(
      "https://auth-staging.example.test/auth/reauth/account-delete?returnTo=https://evil.example",
    ),
    async (options) => {
      receivedOptions = options;
      return "https://api.workos.com/user_management/authorize?synthetic=reauth";
    },
  );

  assert.deepEqual(receivedOptions, {
    maxAge: 300,
    returnTo: "/app/account/delete",
  });
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://api.workos.com/user_management/authorize?synthetic=reauth",
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("account deletion reauthentication failures stay on the local auth error page", async () => {
  const response = await startAccountDeleteReauthentication(
    new Request("https://auth-staging.example.test/auth/reauth/account-delete"),
    async () => {
      throw new Error("synthetic WorkOS failure");
    },
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://auth-staging.example.test/auth/error",
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});
