export const accountLinkStateCookieName = "__Host-fameko-account-link";
export const accountLinkStateTtlSeconds = 10 * 60;

type AuthEnvironment = Record<string, string | undefined>;

type AccountLinkStatePayload = {
  expiresAt: number;
  grantId: string;
  issuedAt: number;
  nonce: string;
  purpose: "fameko-account-link-v1";
  version: 1;
};

export type VerifiedAccountLinkState = {
  expiresAt: number;
  grantId: string;
  stateHash: string;
  token: string;
};

export type AccountLinkStateValidationResult =
  | { code: "configuration_error" | "expired" | "invalid" | "mismatch" | "missing"; ok: false }
  | { ok: true; state: VerifiedAccountLinkState };

const encoder = new TextEncoder();
const signingContext = "fameko-account-link-state-signing-v1";
const clockSkewSeconds = 30;
const maximumTokenLength = 1024;

function epochSeconds(now = Date.now()): number {
  return Math.floor(now / 1000);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return null;
  }
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/")
      + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function accountLinkSecret(environment: AuthEnvironment): string {
  const value = environment.WORKOS_COOKIE_PASSWORD?.trim();
  if (!value || value.length < 32) {
    throw new Error("Account linking is unavailable.");
  }
  return value;
}

async function signingKey(environment: AuthEnvironment): Promise<CryptoKey> {
  const separatedKey = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${signingContext}\0${accountLinkSecret(environment)}`),
  );
  return crypto.subtle.importKey(
    "raw",
    separatedKey,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

async function stateHash(token: string): Promise<string> {
  return toBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))),
  );
}

function isPayload(value: unknown): value is AccountLinkStatePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<AccountLinkStatePayload>;
  return payload.version === 1
    && payload.purpose === "fameko-account-link-v1"
    && typeof payload.grantId === "string"
    && /^[0-9a-f-]{36}$/iu.test(payload.grantId)
    && typeof payload.nonce === "string"
    && /^[0-9a-f-]{36}$/iu.test(payload.nonce)
    && Number.isInteger(payload.issuedAt)
    && Number.isInteger(payload.expiresAt)
    && (payload.expiresAt as number) - (payload.issuedAt as number)
      === accountLinkStateTtlSeconds;
}

export async function issueAccountLinkState(
  environment: AuthEnvironment,
  options: { grantId?: string; nonce?: string; now?: number } = {},
): Promise<VerifiedAccountLinkState> {
  const issuedAt = epochSeconds(options.now);
  const payload: AccountLinkStatePayload = {
    expiresAt: issuedAt + accountLinkStateTtlSeconds,
    grantId: options.grantId ?? crypto.randomUUID(),
    issuedAt,
    nonce: options.nonce ?? crypto.randomUUID(),
    purpose: "fameko-account-link-v1",
    version: 1,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(environment),
    encoder.encode(`${signingContext}.${encodedPayload}`),
  );
  const token = `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
  return {
    expiresAt: payload.expiresAt,
    grantId: payload.grantId,
    stateHash: await stateHash(token),
    token,
  };
}

export async function validateAccountLinkState(
  callbackState: string | undefined,
  cookieValue: string | undefined,
  environment: AuthEnvironment,
  now = Date.now(),
): Promise<AccountLinkStateValidationResult> {
  if (!callbackState || !cookieValue) {
    return { code: "missing", ok: false };
  }
  if (callbackState !== cookieValue) {
    return { code: "mismatch", ok: false };
  }
  if (callbackState.length > maximumTokenLength) {
    return { code: "invalid", ok: false };
  }
  const [encodedPayload, encodedSignature, ...extra] = callbackState.split(".");
  if (!encodedPayload || !encodedSignature || extra.length > 0) {
    return { code: "invalid", ok: false };
  }
  const payloadBytes = fromBase64Url(encodedPayload);
  const signature = fromBase64Url(encodedSignature);
  if (!payloadBytes || !signature) {
    return { code: "invalid", ok: false };
  }
  try {
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await signingKey(environment),
      Uint8Array.from(signature),
      encoder.encode(`${signingContext}.${encodedPayload}`),
    );
    if (!validSignature) {
      return { code: "invalid", ok: false };
    }
    const payload: unknown = JSON.parse(new TextDecoder().decode(payloadBytes));
    const current = epochSeconds(now);
    if (!isPayload(payload) || payload.issuedAt > current + clockSkewSeconds) {
      return { code: "invalid", ok: false };
    }
    if (payload.expiresAt <= current) {
      return { code: "expired", ok: false };
    }
    return {
      ok: true,
      state: {
        expiresAt: payload.expiresAt,
        grantId: payload.grantId,
        stateHash: await stateHash(callbackState),
        token: callbackState,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Account linking is unavailable.") {
      return { code: "configuration_error", ok: false };
    }
    return { code: "invalid", ok: false };
  }
}

export function readAccountLinkStateCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }
    if (part.slice(0, separator).trim() === accountLinkStateCookieName) {
      return part.slice(separator + 1).trim() || undefined;
    }
  }
  return undefined;
}

export function accountLinkStateSetCookie(
  token: string,
  expiresAt: number,
  now = Date.now(),
): string {
  const maxAge = Math.max(0, expiresAt - epochSeconds(now));
  return `${accountLinkStateCookieName}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function accountLinkStateDeleteCookie(): string {
  return `${accountLinkStateCookieName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`;
}
