import type { AuthorizedPilotContext } from "../identity/identity-types.ts";
import {
  currentPrivacyDocumentVersion,
  currentTermsDocumentVersion,
} from "./legal-versions.ts";

export async function hasAcceptedCurrentTerms(
  database: D1Database,
  userId: string,
): Promise<boolean> {
  const acceptance = await database
    .prepare(
      `SELECT 1 AS accepted
       FROM legal_acceptances
       WHERE user_id = ? AND terms_version = ? AND privacy_version = ?
       LIMIT 1`,
    )
    .bind(
      userId,
      currentTermsDocumentVersion,
      currentPrivacyDocumentVersion,
    )
    .first<{ accepted: number }>();
  return acceptance?.accepted === 1;
}

export async function recordCurrentTermsAcceptance(
  database: D1Database,
  context: AuthorizedPilotContext,
  acceptedAt = new Date(),
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO legal_acceptances
         (user_id, terms_version, privacy_version, accepted_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, terms_version, privacy_version) DO NOTHING`,
    )
    .bind(
      context.user.id,
      currentTermsDocumentVersion,
      currentPrivacyDocumentVersion,
      acceptedAt.toISOString(),
    )
    .run();
}

export function mayUseAppWithoutCurrentTerms(pathname: string): boolean {
  return pathname === "/account-link/confirm"
    || pathname === "/app/legal/accept"
    || pathname === "/app/api/legal/accept"
    || pathname === "/app/account/export"
    || pathname === "/app/api/account/export"
    || pathname === "/app/account/delete"
    || pathname === "/app/api/account/delete"
    || pathname === "/app/api/session";
}

export function safePostAcceptancePath(value: FormDataEntryValue | null): string {
  if (
    typeof value !== "string"
    || !(value === "/app" || value.startsWith("/app/") || value.startsWith("/app?"))
    || value.startsWith("//")
    || mayUseAppWithoutCurrentTerms(new URL(value, "https://fameko.invalid").pathname)
  ) {
    return "/app";
  }
  return value;
}
