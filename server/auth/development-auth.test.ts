import assert from "node:assert/strict";
import test from "node:test";

import { authorizeRequest } from "./authorize-request.ts";
import {
  isLocalDevelopmentRequest,
  localDevelopmentAuthContext,
} from "./development-auth.ts";

function localRequest(
  url = "http://localhost:3000/app",
  host = "localhost:3000",
): Request {
  return new Request(url, { headers: { Host: host } });
}

test("development bypass requires both development environment and an exact loopback host", () => {
  assert.equal(
    isLocalDevelopmentRequest(localRequest(), { NODE_ENV: "development" }),
    true,
  );
  assert.equal(
    isLocalDevelopmentRequest(
      localRequest("http://127.0.0.1:3000/app", "127.0.0.1:3000"),
      { NODE_ENV: "development" },
    ),
    true,
  );
  assert.equal(
    isLocalDevelopmentRequest(localRequest(), { NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    isLocalDevelopmentRequest(localRequest("https://fameko.se/app", "fameko.se"), {
      NODE_ENV: "development",
    }),
    false,
  );
  assert.equal(
    isLocalDevelopmentRequest(localRequest("http://localhost:3000/app", "fameko.se"), {
      NODE_ENV: "development",
    }),
    false,
  );
  assert.equal(
    isLocalDevelopmentRequest(localRequest("https://fameko.se/app", "localhost:3000"), {
      NODE_ENV: "development",
    }),
    false,
  );
});

test("development authorization returns one stable local User and Household", async () => {
  const authorization = await authorizeRequest(localRequest(), {
    environment: { NODE_ENV: "development" },
  });

  assert.deepEqual(authorization, {
    context: localDevelopmentAuthContext,
    mode: "development",
    ok: true,
  });
  assert.equal(localDevelopmentAuthContext.user.id, "fameko-local-development-user");
  assert.equal(
    localDevelopmentAuthContext.household.id,
    "fameko-local-development-household",
  );
});

test("production localhost still fails closed without an Access token", async () => {
  const authorization = await authorizeRequest(localRequest(), {
    environment: { NODE_ENV: "production" },
  });

  assert.deepEqual(authorization, { code: "token_missing", ok: false });
});
