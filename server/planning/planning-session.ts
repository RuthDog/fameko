import type { AuthorizedPilotContext } from "../identity/identity-types.ts";

export const planningSessionHeader = "x-fameko-planning-session";

export async function createPlanningSessionId(
  context: AuthorizedPilotContext,
): Promise<string> {
  const value = `fameko-planning-session-v1\0${context.user.id}\0${context.household.id}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hasMatchingPlanningSession(
  request: Request,
  context: AuthorizedPilotContext,
): Promise<boolean> {
  const suppliedSession = request.headers.get(planningSessionHeader);
  return suppliedSession !== null && suppliedSession === (await createPlanningSessionId(context));
}
