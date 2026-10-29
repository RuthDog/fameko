"use server";

import { signOut } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import {
  cloudflareAccessAuthMode,
  getAuthMode,
  validateWorkosConfiguration,
  workosStagingAuthMode,
} from "../../../server/auth/auth-mode.ts";

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

  if (mode === workosStagingAuthMode) {
    try {
      validateWorkosConfiguration(process.env);
      await signOut({ returnTo: "/" });
    } catch {
      redirect("/auth/error");
    }
  }

  redirect("/auth/error");
}
