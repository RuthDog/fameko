import type { VerifiedWorkosUser } from "./workos-auth-context.ts";

export async function getVerifiedWorkosSessionUser(): Promise<VerifiedWorkosUser | null> {
  const { withAuth } = await import("@workos-inc/authkit-nextjs");
  const { user } = await withAuth();
  return user;
}
