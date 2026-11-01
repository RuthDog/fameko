import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  const [exportRoute, deleteRoute, accountMenu] = await Promise.all([
    readFile(new URL("../../app/app/api/account/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/app/api/account/delete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/app/account-menu.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(exportRoute, /authorization\.context/);
  assert.match(exportRoute, /Content-Disposition/);
  assert.match(exportRoute, /private, no-store/);
  assert.match(deleteRoute, /checkRecentAuth\(\{ maxAge: 300 \}\)/);
  assert.match(deleteRoute, /RADERA MITT KONTO/);
  assert.match(deleteRoute, /listActiveSessionIds/);
  assert.match(deleteRoute, /revokeSession/);
  assert.match(deleteRoute, /deleteUser/);
  assert.match(accountMenu, /Exportera mina uppgifter/);
  assert.match(accountMenu, /Radera mitt konto/);
});
