import { isLocalDevelopmentRequest } from "../auth/development-auth.ts";

export function isSameOriginJsonRequest(
  request: Request,
  authorizationMode: "access" | "development" = "access",
  environment: Record<string, string | undefined> = process.env,
): boolean {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const origin = request.headers.get("origin");

  if (!contentType.startsWith("application/json") || !origin) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);

    if (originUrl.origin === requestUrl.origin) {
      return true;
    }

    if (
      authorizationMode !== "development" ||
      !isLocalDevelopmentRequest(request, environment)
    ) {
      return false;
    }

    const host = request.headers.get("host");

    if (!host) {
      return false;
    }

    return originUrl.origin === new URL(`${requestUrl.protocol}//${host}`).origin;
  } catch {
    return false;
  }
}
