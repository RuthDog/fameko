export const adultRegistrationAttestation = "adult-confirmed-v1";
export const registrationAttestationCookieName = "__Host-fameko-sign-up";
export const registrationAttestationTtlSeconds = 5 * 60;

type AuthEnvironment = Record<string, string | undefined>;
type RegistrationPhase = "issued" | "started";

type RegistrationAttestationPayload = {
  expiresAt: number;
  issuedAt: number;
  nonce: string;
  phase: RegistrationPhase;
  purpose: typeof adultRegistrationAttestation;
  version: 1;
};

type AttestationOptions = {
  nonce?: string;
  now?: number;
};

const encoder = new TextEncoder();
const signingContext = "fameko-registration-attestation-signing-v1";
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

function registrationSecret(environment: AuthEnvironment): string {
  const secret = environment.WORKOS_COOKIE_PASSWORD?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Registration attestation is unavailable.");
  }
  return secret;
}

async function signingKey(environment: AuthEnvironment): Promise<CryptoKey> {
  const separatedKey = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${signingContext}\0${registrationSecret(environment)}`),
  );
  return crypto.subtle.importKey(
    "raw",
    separatedKey,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(
  payload: RegistrationAttestationPayload,
  environment: AuthEnvironment,
): Promise<string> {
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(environment),
    encoder.encode(`${signingContext}.${encodedPayload}`),
  );
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

function isPayload(
  value: unknown,
  phase: RegistrationPhase,
  now: number,
): value is RegistrationAttestationPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<RegistrationAttestationPayload>;
  return payload.version === 1
    && payload.purpose === adultRegistrationAttestation
    && payload.phase === phase
    && typeof payload.nonce === "string"
    && /^[0-9a-f-]{36}$/iu.test(payload.nonce)
    && typeof payload.issuedAt === "number"
    && Number.isInteger(payload.issuedAt)
    && typeof payload.expiresAt === "number"
    && Number.isInteger(payload.expiresAt)
    && payload.issuedAt <= now + clockSkewSeconds
    && payload.expiresAt > now
    && payload.expiresAt - payload.issuedAt === registrationAttestationTtlSeconds;
}

async function verifyToken(
  token: string | undefined,
  phase: RegistrationPhase,
  environment: AuthEnvironment,
  now = epochSeconds(),
): Promise<RegistrationAttestationPayload | null> {
  if (!token || token.length > maximumTokenLength) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [encodedPayload, encodedSignature] = parts;
  const signature = fromBase64Url(encodedSignature);
  const payloadBytes = fromBase64Url(encodedPayload);
  if (!signature || !payloadBytes) {
    return null;
  }
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    await signingKey(environment),
    Uint8Array.from(signature),
    encoder.encode(`${signingContext}.${encodedPayload}`),
  );
  if (!validSignature) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(new TextDecoder().decode(payloadBytes));
    return isPayload(payload, phase, now) ? payload : null;
  } catch {
    return null;
  }
}

export async function issueRegistrationAttestation(
  environment: AuthEnvironment,
  options: AttestationOptions = {},
): Promise<{ expiresAt: number; token: string }> {
  const issuedAt = epochSeconds(options.now);
  const payload: RegistrationAttestationPayload = {
    expiresAt: issuedAt + registrationAttestationTtlSeconds,
    issuedAt,
    nonce: options.nonce ?? crypto.randomUUID(),
    phase: "issued",
    purpose: adultRegistrationAttestation,
    version: 1,
  };
  return { expiresAt: payload.expiresAt, token: await signPayload(payload, environment) };
}

export async function startRegistrationAttestation(
  token: string | undefined,
  environment: AuthEnvironment,
  now = Date.now(),
): Promise<{ expiresAt: number; token: string } | null> {
  const verified = await verifyToken(token, "issued", environment, epochSeconds(now));
  if (!verified) {
    return null;
  }
  const started = { ...verified, phase: "started" as const };
  return { expiresAt: started.expiresAt, token: await signPayload(started, environment) };
}

export async function verifyRegistrationCallbackAttestation(
  callbackState: string | undefined,
  cookieValue: string | undefined,
  environment: AuthEnvironment,
  now = Date.now(),
): Promise<boolean> {
  if (!callbackState || !cookieValue || callbackState !== cookieValue) {
    return false;
  }
  return Boolean(
    await verifyToken(callbackState, "started", environment, epochSeconds(now)),
  );
}

export function readRegistrationAttestationCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === registrationAttestationCookieName) {
      return part.slice(separator + 1).trim() || undefined;
    }
  }
  return undefined;
}

export function registrationAttestationSetCookie(
  token: string,
  expiresAt: number,
  now = Date.now(),
): string {
  const maxAge = Math.max(0, expiresAt - epochSeconds(now));
  return `${registrationAttestationCookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function registrationAttestationDeleteCookie(): string {
  return `${registrationAttestationCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function mayProvisionWorkosIdentity(
  identityAlreadyExists: boolean,
  callbackAttestationValid: boolean,
): boolean {
  return identityAlreadyExists || callbackAttestationValid;
}
