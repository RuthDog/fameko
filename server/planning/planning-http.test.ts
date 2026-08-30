import assert from "node:assert/strict";
import test from "node:test";

import { isSameOriginJsonRequest } from "./same-origin-json.ts";

const developmentEnvironment = { NODE_ENV: "development" };

function jsonRequest({
  host,
  origin,
  url = "http://localhost:3001/app/api/planning-years/2026",
}: {
  host: string;
  origin: string;
  url?: string;
}) {
  return new Request(url, {
    headers: {
      "Content-Type": "application/json",
      Host: host,
      Origin: origin,
    },
    method: "PUT",
  });
}

function isDevelopmentSameOriginJsonRequest(request: Request) {
  return isSameOriginJsonRequest(request, "development", developmentEnvironment);
}

test("development accepts the browser origin reconstructed from the allowed LAN Host", () => {
  for (const origin of [
    "http://127.0.0.1:3001",
    "http://10.20.30.40:3001",
    "http://172.20.1.2:3001",
    "http://192.168.1.175:3001",
  ]) {
    const host = new URL(origin).host;

    assert.equal(
      isDevelopmentSameOriginJsonRequest(jsonRequest({ host, origin })),
      true,
      origin,
    );
  }
});

test("development origin reconstruction is port-sensitive without hardcoding a port", () => {
  assert.equal(
    isDevelopmentSameOriginJsonRequest(
      jsonRequest({
        host: "192.168.1.175:4173",
        origin: "http://192.168.1.175:4173",
      }),
    ),
    true,
  );
  assert.equal(
    isDevelopmentSameOriginJsonRequest(
      jsonRequest({
        host: "192.168.1.175:3001",
        origin: "http://192.168.1.175:3000",
      }),
    ),
    false,
  );
});

test("development origin reconstruction rejects public, cross-origin, and malformed requests", () => {
  assert.equal(
    isDevelopmentSameOriginJsonRequest(
      jsonRequest({ host: "8.8.8.8:3001", origin: "http://8.8.8.8:3001" }),
    ),
    false,
  );
  assert.equal(
    isDevelopmentSameOriginJsonRequest(
      jsonRequest({
        host: "192.168.1.175:3001",
        origin: "http://127.0.0.1:3001",
      }),
    ),
    false,
  );
  assert.equal(
    isDevelopmentSameOriginJsonRequest(
      new Request("http://localhost:3001/app/api/planning-years/2026", {
        headers: {
          Host: "localhost:3001",
          Origin: "http://localhost:3001",
        },
        method: "PUT",
      }),
    ),
    false,
  );
});

test("access mode keeps the original request URL same-origin rule", () => {
  assert.equal(
    isSameOriginJsonRequest(
      jsonRequest({
        host: "fameko.se",
        origin: "https://fameko.se",
        url: "https://fameko.se/app/api/planning-years/2026",
      }),
      "access",
    ),
    true,
  );
  assert.equal(
    isSameOriginJsonRequest(
      jsonRequest({
        host: "192.168.1.175:3001",
        origin: "http://192.168.1.175:3001",
      }),
      "access",
    ),
    false,
  );
});
