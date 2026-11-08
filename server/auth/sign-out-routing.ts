import {
  cloudflareAccessAuthMode,
  type AuthMode,
  workosProductionAuthMode,
  workosProductionTransitionAuthMode,
  workosStagingAuthMode,
} from "./auth-mode.ts";
import type { VerifiedWorkosUser } from "./workos-auth-context.ts";

export type SignOutMethod = "cloudflare_access" | "workos";

export class SignOutContextError extends Error {
  constructor() {
    super("A verified sign-out context is required.");
    this.name = "SignOutContextError";
  }
}

type SignOutContextResolvers = {
  hasVerifiedAccessSession: () => Promise<boolean>;
  workosUserResolver: () => Promise<VerifiedWorkosUser | null>;
};

export async function selectSignOutMethod(
  mode: AuthMode,
  resolvers: SignOutContextResolvers,
): Promise<SignOutMethod> {
  if (mode === cloudflareAccessAuthMode) {
    return "cloudflare_access";
  }

  if (mode === workosStagingAuthMode || mode === workosProductionAuthMode) {
    return "workos";
  }

  if (mode !== workosProductionTransitionAuthMode) {
    throw new SignOutContextError();
  }

  const workosUser = await resolvers.workosUserResolver();
  if (workosUser) {
    return "workos";
  }

  if (await resolvers.hasVerifiedAccessSession()) {
    return "cloudflare_access";
  }

  throw new SignOutContextError();
}
