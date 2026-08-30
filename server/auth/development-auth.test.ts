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

test("development bypass accepts exact loopback and private IPv4 LAN hosts", () => {
  const allowedRequests = [
    localRequest(),
    localRequest("http://127.0.0.1:3000/app", "127.0.0.1:3000"),
    localRequest("http://[::1]:3000/app", "[::1]:3000"),
    localRequest("http://10.0.0.1:3000/app", "10.0.0.1:3000"),
    localRequest("http://10.255.255.254:3000/app", "10.255.255.254:3000"),
    localRequest("http://172.16.0.1:3000/app", "172.16.0.1:3000"),
    localRequest("http://172.31.255.254:3000/app", "172.31.255.254:3000"),
    localRequest("http://192.168.0.1:3000/app", "192.168.0.1:3000"),
    localRequest("http://192.168.255.254:3000/app", "192.168.255.254:3000"),
  ];

  for (const request of allowedRequests) {
    assert.equal(
      isLocalDevelopmentRequest(request, { NODE_ENV: "development" }),
      true,
      request.url,
    );
  }
});

test("development bypass rejects public, adjacent, and non-canonical hosts", () => {
  const deniedRequests = [
    localRequest("http://8.8.8.8:3000/app", "8.8.8.8:3000"),
    localRequest("http://11.0.0.1:3000/app", "11.0.0.1:3000"),
    localRequest("http://172.15.255.255:3000/app", "172.15.255.255:3000"),
    localRequest("http://172.32.0.1:3000/app", "172.32.0.1:3000"),
    localRequest("http://192.167.255.255:3000/app", "192.167.255.255:3000"),
    localRequest("http://192.169.0.1:3000/app", "192.169.0.1:3000"),
    localRequest("http://127.0.0.2:3000/app", "127.0.0.2:3000"),
    localRequest("http://localhost.example:3000/app", "localhost.example:3000"),
    localRequest("http://192.168.1.8:3000/app", "192.168.001.010:3000"),
  ];

  for (const request of deniedRequests) {
    assert.equal(
      isLocalDevelopmentRequest(request, { NODE_ENV: "development" }),
      false,
      request.url,
    );
  }
});

test("development bypass requires both URL and Host header hostnames to be allowed", () => {
  assert.equal(
    isLocalDevelopmentRequest(localRequest("http://localhost:3000/app", "192.168.1.20:3000"), {
      NODE_ENV: "development",
    }),
    true,
  );
  assert.equal(
    isLocalDevelopmentRequest(localRequest("http://192.168.1.20:3000/app", "fameko.se"), {
      NODE_ENV: "development",
    }),
    false,
  );
  assert.equal(
    isLocalDevelopmentRequest(localRequest("https://fameko.se/app", "192.168.1.20:3000"), {
      NODE_ENV: "development",
    }),
    false,
  );
  assert.equal(
    isLocalDevelopmentRequest(new Request("http://192.168.1.20:3000/app"), {
      NODE_ENV: "development",
    }),
    false,
  );
});

test("private LAN hosts never bypass outside exact development mode", () => {
  const request = localRequest("http://192.168.1.20:3000/app", "192.168.1.20:3000");

  for (const nodeEnv of ["production", "preview", "test", undefined]) {
    assert.equal(isLocalDevelopmentRequest(request, { NODE_ENV: nodeEnv }), false);
  }
});

test("loopback and LAN authorization return the same stable development context", async () => {
  const requests = [
    localRequest(),
    localRequest("http://10.20.30.40:3000/app", "10.20.30.40:3000"),
    localRequest("http://172.20.1.2:3000/app", "172.20.1.2:3000"),
    localRequest("http://192.168.1.20:3000/app", "192.168.1.20:3000"),
  ];

  for (const request of requests) {
    const authorization = await authorizeRequest(request, {
      environment: { NODE_ENV: "development" },
    });

    assert.deepEqual(authorization, {
      context: localDevelopmentAuthContext,
      mode: "development",
      ok: true,
    });
  }

  assert.equal(localDevelopmentAuthContext.user.id, "fameko-local-development-user");
  assert.equal(
    localDevelopmentAuthContext.household.id,
    "fameko-local-development-household",
  );
});

test("production LAN and fameko.se continue through ordinary Access authorization", async () => {
  const requests = [
    localRequest(),
    localRequest("http://192.168.1.20:3000/app", "192.168.1.20:3000"),
    localRequest("https://fameko.se/app", "fameko.se"),
  ];

  for (const request of requests) {
    const authorization = await authorizeRequest(request, {
      environment: { NODE_ENV: "production" },
    });

    assert.deepEqual(authorization, { code: "token_missing", ok: false });
  }
});
