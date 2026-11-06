import {
  AuthConfigurationError,
  getAuthMode,
  validateCloudflareAccessConfiguration,
  validateWorkosConfiguration,
  workosProductionTransitionAuthMode,
} from "./auth-mode.ts";
import {
  accountLinkStateDeleteCookie,
  accountLinkStateSetCookie,
  issueAccountLinkState,
  readAccountLinkStateCookie,
  validateAccountLinkState,
  type VerifiedAccountLinkState,
} from "./account-link-state.ts";
import {
  authorizeExistingAccessRequest,
  type AuthorizationFailureCode,
} from "./authorize-request.ts";
import { isSameOriginFormRequest } from "./public-auth-http.ts";
import {
  verifiedAuthContextFromWorkosUser,
  type VerifiedWorkosUser,
} from "./workos-auth-context.ts";
import {
  AccountLinkingError,
  bindAccountLinkTarget,
  consumeAccountLinkGrant,
  createAccountLinkGrant,
  getAccountLinkGrant,
  prepareAccountLinkPlan,
} from "../identity/account-linking.ts";
import type {
  AuthorizedPilotContext,
  VerifiedAuthContext,
} from "../identity/identity-types.ts";

type AuthEnvironment = Record<string, string | undefined>;

type AccountLinkGate =
  | { ok: false; status: 404 | 503 }
  | { ok: true; publicOrigin: string };

type AccessResolver = typeof authorizeExistingAccessRequest;

type AccountLinkDependencies = {
  accessResolver?: AccessResolver;
  database: D1Database;
  workosUserResolver: () => Promise<VerifiedWorkosUser | null>;
};

export type AccountLinkFailureCode =
  | AuthorizationFailureCode
  | "confirmation_required"
  | "grant_invalid"
  | "request_invalid"
  | "workos_identity_missing";

export type AccountLinkContext = {
  source: AuthorizedPilotContext;
  sourceIdentity: VerifiedAuthContext;
  state: VerifiedAccountLinkState;
  targetIdentity: VerifiedAuthContext;
};

export function accountLinkGate(environment: AuthEnvironment): AccountLinkGate {
  try {
    const mode = getAuthMode(environment);
    if (mode !== workosProductionTransitionAuthMode) {
      return { ok: false, status: 404 };
    }
    validateCloudflareAccessConfiguration(environment);
    const { publicOrigin } = validateWorkosConfiguration(environment);
    return { ok: true, publicOrigin };
  } catch (error) {
    return error instanceof AuthConfigurationError
      ? { ok: false, status: 503 }
      : { ok: false, status: 503 };
  }
}

function redirect(location: string, setCookie?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: location,
    "Referrer-Policy": "no-referrer",
  });
  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }
  return new Response(null, { headers, status: 303 });
}

export function accountLinkUnavailableResponse(status: 404 | 503): Response {
  return new Response(status === 404 ? "Not found" : "Account linking unavailable", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
}

export async function startAccountLink(
  request: Request,
  environment: AuthEnvironment,
  dependencies: AccountLinkDependencies & {
    createSignInUrl: (options: { returnTo: string; state: string }) => Promise<string>;
  },
): Promise<Response> {
  const gate = accountLinkGate(environment);
  if (!gate.ok) {
    return accountLinkUnavailableResponse(gate.status);
  }
  if (!isSameOriginFormRequest(request, gate.publicOrigin)) {
    return accountLinkUnavailableResponse(404);
  }
  const form = await request.formData();
  if (form.get("account-link-confirmation") !== "confirmed") {
    return redirect(new URL("/account-link?error=confirmation-required", gate.publicOrigin).toString());
  }

  const access = await (dependencies.accessResolver ?? authorizeExistingAccessRequest)(
    request,
    { database: dependencies.database, environment },
  );
  if (!access.ok) {
    return accountLinkUnavailableResponse(access.code === "token_missing" ? 404 : 503);
  }

  try {
    const state = await issueAccountLinkState(environment);
    await createAccountLinkGrant(dependencies.database, access.context, state);
    const authorizationUrl = await dependencies.createSignInUrl({
      returnTo: "/account-link/confirm",
      state: state.token,
    });
    return redirect(
      authorizationUrl,
      accountLinkStateSetCookie(state.token, state.expiresAt),
    );
  } catch {
    return redirect(
      new URL("/account-link?error=link-failed", gate.publicOrigin).toString(),
      accountLinkStateDeleteCookie(),
    );
  }
}

export async function bindAccountLinkCallback(
  callbackState: string | undefined,
  cookieValue: string | undefined,
  user: VerifiedWorkosUser,
  database: D1Database,
  environment: AuthEnvironment,
  now = new Date(),
): Promise<void> {
  const gate = accountLinkGate(environment);
  if (!gate.ok) {
    throw new AccountLinkingError();
  }
  const state = await validateAccountLinkState(
    callbackState,
    cookieValue,
    environment,
    now.getTime(),
  );
  if (!state.ok) {
    throw new AccountLinkingError();
  }
  const targetIdentity = verifiedAuthContextFromWorkosUser(user);
  await bindAccountLinkTarget(database, state.state, targetIdentity, now);
}

async function verifiedAccountLinkContext(
  request: Request,
  environment: AuthEnvironment,
  dependencies: AccountLinkDependencies,
  submittedState?: string,
  now = new Date(),
): Promise<{ code: AccountLinkFailureCode; ok: false } | { context: AccountLinkContext; ok: true }> {
  const gate = accountLinkGate(environment);
  if (!gate.ok) {
    return { code: "configuration_missing", ok: false };
  }
  const cookieState = readAccountLinkStateCookie(request);
  const state = await validateAccountLinkState(
    submittedState ?? cookieState,
    cookieState,
    environment,
    now.getTime(),
  );
  if (!state.ok) {
    return { code: "grant_invalid", ok: false };
  }
  const access = await (dependencies.accessResolver ?? authorizeExistingAccessRequest)(
    request,
    { database: dependencies.database, environment },
  );
  if (!access.ok) {
    return access;
  }
  const workosUser = await dependencies.workosUserResolver();
  if (!workosUser) {
    return { code: "workos_identity_missing", ok: false };
  }
  let targetIdentity: VerifiedAuthContext;
  try {
    targetIdentity = verifiedAuthContextFromWorkosUser(workosUser);
  } catch {
    return { code: "workos_identity_missing", ok: false };
  }
  const grant = await getAccountLinkGrant(dependencies.database, state.state.grantId);
  if (!grant || grant.stateHash !== state.state.stateHash) {
    return { code: "grant_invalid", ok: false };
  }
  try {
    prepareAccountLinkPlan(grant, access.authContext, targetIdentity, now);
  } catch {
    return { code: "grant_invalid", ok: false };
  }
  return {
    context: {
      source: access.context,
      sourceIdentity: access.authContext,
      state: state.state,
      targetIdentity,
    },
    ok: true,
  };
}

export async function getAccountLinkConfirmation(
  request: Request,
  environment: AuthEnvironment,
  dependencies: AccountLinkDependencies,
  now = new Date(),
): Promise<{ code: AccountLinkFailureCode; ok: false } | { context: AccountLinkContext; ok: true }> {
  return verifiedAccountLinkContext(request, environment, dependencies, undefined, now);
}

export async function completeAccountLink(
  request: Request,
  environment: AuthEnvironment,
  dependencies: AccountLinkDependencies,
  now = new Date(),
): Promise<Response> {
  const gate = accountLinkGate(environment);
  if (!gate.ok) {
    return accountLinkUnavailableResponse(gate.status);
  }
  if (!isSameOriginFormRequest(request, gate.publicOrigin)) {
    return accountLinkUnavailableResponse(404);
  }
  const form = await request.formData();
  const submittedState = form.get("account-link-state");
  if (
    form.get("account-link-confirmation") !== "confirmed"
    || typeof submittedState !== "string"
  ) {
    return redirect(new URL("/account-link/confirm?error=confirmation-required", gate.publicOrigin).toString());
  }
  const verified = await verifiedAccountLinkContext(
    request,
    environment,
    dependencies,
    submittedState,
    now,
  );
  if (!verified.ok) {
    return redirect(
      new URL("/account-link?error=link-invalid", gate.publicOrigin).toString(),
      accountLinkStateDeleteCookie(),
    );
  }
  try {
    await consumeAccountLinkGrant(
      dependencies.database,
      verified.context.state,
      verified.context.sourceIdentity,
      verified.context.targetIdentity,
      now,
    );
    return redirect(
      new URL("/app", gate.publicOrigin).toString(),
      accountLinkStateDeleteCookie(),
    );
  } catch {
    return redirect(
      new URL("/account-link?error=link-invalid", gate.publicOrigin).toString(),
      accountLinkStateDeleteCookie(),
    );
  }
}
