export type AccessClaims = {
  aud: string | string[];
  email: string;
  exp: number;
  iat: number;
  iss: string;
  nbf: number;
  sub: string;
  type: "app";
};

type JsonWebKeyWithKid = JsonWebKey & {
  kid: string;
};

type JwksResponse = {
  keys?: JsonWebKey[];
};

type CachedJwks = {
  expiresAt: number;
  keys: JsonWebKeyWithKid[];
};

const jwksCache = new Map<string, CachedJwks>();
const jwksCacheTtlMs = 5 * 60 * 1000;
const clockToleranceSeconds = 60;
const maximumTokenLength = 16_384;

export class AccessTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessTokenError";
  }
}

function normalizeTeamDomain(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);

  if (url.protocol !== "https:") {
    throw new AccessTokenError("Access team domain must use HTTPS.");
  }

  return url.origin;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);

  try {
    const binary = atob(normalized + padding);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new AccessTokenError("Access token contains invalid base64url data.");
  }
}

function decodeJsonPart(value: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch (error) {
    if (error instanceof AccessTokenError) {
      throw error;
    }

    throw new AccessTokenError("Access token contains invalid JSON.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringClaim(
  payload: Record<string, unknown>,
  claim: string,
): string {
  const value = payload[claim];

  if (typeof value !== "string" || value.trim() === "") {
    throw new AccessTokenError(`Access token is missing ${claim}.`);
  }

  return value;
}

function readNumericClaim(
  payload: Record<string, unknown>,
  claim: string,
): number {
  const value = payload[claim];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AccessTokenError(`Access token is missing ${claim}.`);
  }

  return value;
}

function validateAudience(value: unknown, expectedAudience: string): string | string[] {
  if (typeof value === "string") {
    if (value !== expectedAudience) {
      throw new AccessTokenError("Access token has an unexpected audience.");
    }

    return value;
  }

  if (
    Array.isArray(value) &&
    value.every((audience) => typeof audience === "string") &&
    value.includes(expectedAudience)
  ) {
    return value;
  }

  throw new AccessTokenError("Access token has an unexpected audience.");
}

async function fetchJwks(issuer: string, forceRefresh = false): Promise<JsonWebKeyWithKid[]> {
  const cached = jwksCache.get(issuer);

  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  let response: Response;

  try {
    response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new AccessTokenError("Access signing keys could not be reached.");
  }

  if (!response.ok) {
    throw new AccessTokenError("Access signing keys could not be loaded.");
  }

  const body = (await response.json()) as JwksResponse;
  const keys = Array.isArray(body.keys)
    ? body.keys.filter(
        (key): key is JsonWebKeyWithKid => {
          const candidate = key as JsonWebKey & { kid?: unknown };
          return typeof candidate.kid === "string" && candidate.kid.length > 0;
        },
      )
    : [];

  if (keys.length === 0) {
    throw new AccessTokenError("Access signing keys are missing.");
  }

  jwksCache.set(issuer, {
    expiresAt: Date.now() + jwksCacheTtlMs,
    keys,
  });

  return keys;
}

async function findSigningKey(issuer: string, kid: string): Promise<JsonWebKeyWithKid> {
  let keys = await fetchJwks(issuer);
  let key = keys.find((candidate) => candidate.kid === kid);

  if (!key) {
    keys = await fetchJwks(issuer, true);
    key = keys.find((candidate) => candidate.kid === kid);
  }

  if (!key) {
    throw new AccessTokenError("Access token uses an unknown signing key.");
  }

  return key;
}

export async function verifyAccessToken(
  token: string,
  teamDomain: string,
  expectedAudience: string,
): Promise<AccessClaims> {
  if (!token || token.length > maximumTokenLength) {
    throw new AccessTokenError("Access token is missing or too large.");
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new AccessTokenError("Access token has an invalid format.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader);
  const payload = decodeJsonPart(encodedPayload);

  if (!isRecord(header) || header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new AccessTokenError("Access token has an unsupported signature.");
  }

  if (!isRecord(payload)) {
    throw new AccessTokenError("Access token payload is invalid.");
  }

  const issuer = normalizeTeamDomain(teamDomain);
  const tokenIssuer = readStringClaim(payload, "iss").replace(/\/$/, "");
  if (tokenIssuer !== issuer) {
    throw new AccessTokenError("Access token has an unexpected issuer.");
  }

  const signingKey = await findSigningKey(issuer, header.kid);
  let cryptoKey: CryptoKey;

  try {
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      signingKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new AccessTokenError("Access signing key is invalid.");
  }

  const signatureIsValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new Uint8Array(decodeBase64Url(encodedSignature)),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );

  if (!signatureIsValid) {
    throw new AccessTokenError("Access token signature is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = readNumericClaim(payload, "exp");
  const nbf = readNumericClaim(payload, "nbf");
  const iat = readNumericClaim(payload, "iat");

  if (exp <= now - clockToleranceSeconds) {
    throw new AccessTokenError("Access token has expired.");
  }

  if (nbf > now + clockToleranceSeconds || iat > now + clockToleranceSeconds) {
    throw new AccessTokenError("Access token is not valid yet.");
  }

  if (payload.type !== "app") {
    throw new AccessTokenError("Access token has an unexpected type.");
  }

  return {
    aud: validateAudience(payload.aud, expectedAudience),
    email: readStringClaim(payload, "email").trim().toLowerCase(),
    exp,
    iat,
    iss: tokenIssuer,
    nbf,
    sub: readStringClaim(payload, "sub"),
    type: "app",
  };
}
