"use server";

import { signOut } from "@workos-inc/authkit-nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  cloudflareAccessAuthMode,
  getAuthMode,
  validateCloudflareAccessConfiguration,
  validateProductionTransitionConfiguration,
  validateWorkosConfiguration,
  workosProductionTransitionAuthMode,
} from "../../../server/auth/auth-mode.ts";
import { verifyAccessToken } from "../../../server/auth/access-token.ts";
import { getVerifiedWorkosSessionUser } from "../../../server/auth/workos-session.ts";
import { completeWorkosSignOut } from "../../../server/auth/workos-sign-out.ts";
import { selectSignOutMethod } from "../../../server/auth/sign-out-routing.ts";

async function hasVerifiedAccessSession(): Promise<boolean> {
  try {
    validateCloudflareAccessConfiguration(process.env);
    const requestHeaders = await headers();
    const token = requestHeaders.get("cf-access-jwt-assertion");
    if (!token) {
      return false;
    }
    await verifyAccessToken(
      token,
      process.env.CF_ACCESS_TEAM_DOMAIN as string,
      process.env.CF_ACCESS_AUD as string,
    );
    return true;
  } catch {
    return false;
  }
}

export async function signOutAction(): Promise<void> {
  let mode;
  try {
    mode = getAuthMode(process.env);
  } catch {
    redirect("/auth/error");
  }

  if (mode === cloudflareAccessAuthMode) {
    redirect("/cdn-cgi/access/logout");
  }

  try {
    if (mode === workosProductionTransitionAuthMode) {
      validateProductionTransitionConfiguration(process.env);
    } else {
      validateWorkosConfiguration(process.env);
    }
  } catch {
    redirect("/auth/error");
  }

  let method;
  try {
    method = await selectSignOutMethod(mode, {
      hasVerifiedAccessSession,
      workosUserResolver: getVerifiedWorkosSessionUser,
    });
  } catch {
    redirect("/auth/error");
  }

  if (method === "cloudflare_access") {
    redirect("/cdn-cgi/access/logout");
  }

  await completeWorkosSignOut(() => signOut());
}
