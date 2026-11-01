export function isSameOriginAccountJsonRequest(
  request: Request,
  trustedPublicOrigin: string,
): boolean {
  return request.method === "POST"
    && request.headers.get("content-type")?.toLowerCase().startsWith("application/json") === true
    && request.headers.get("origin") === trustedPublicOrigin
    && request.headers.get("sec-fetch-site") !== "cross-site";
}
