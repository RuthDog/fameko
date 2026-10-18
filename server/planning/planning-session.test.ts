import assert from "node:assert/strict";
import test from "node:test";

import { localDevelopmentAuthContext } from "../auth/development-auth.ts";
import {
  createPlanningSessionId,
  hasMatchingPlanningSession,
  planningSessionHeader,
} from "./planning-session.ts";

test("planning session id is opaque, stable and household-bound", async () => {
  const sessionId = await createPlanningSessionId(localDevelopmentAuthContext);
  const sameSessionId = await createPlanningSessionId(localDevelopmentAuthContext);
  const otherHouseholdId = await createPlanningSessionId({
    ...localDevelopmentAuthContext,
    household: { ...localDevelopmentAuthContext.household, id: "another-household" },
  });
  const otherUserId = await createPlanningSessionId({
    ...localDevelopmentAuthContext,
    membership: { ...localDevelopmentAuthContext.membership, user_id: "another-user" },
    user: { ...localDevelopmentAuthContext.user, id: "another-user" },
  });

  assert.match(sessionId, /^[a-f0-9]{64}$/);
  assert.equal(sessionId, sameSessionId);
  assert.notEqual(sessionId, otherHouseholdId);
  assert.notEqual(sessionId, otherUserId);
  assert.equal(sessionId.includes(localDevelopmentAuthContext.household.id), false);
});

test("mutations require the session id issued for the authorized context", async () => {
  const sessionId = await createPlanningSessionId(localDevelopmentAuthContext);
  const matchingRequest = new Request("http://localhost/app/api/planning-years/2026", {
    headers: { [planningSessionHeader]: sessionId },
  });
  const staleRequest = new Request("http://localhost/app/api/planning-years/2026", {
    headers: { [planningSessionHeader]: "0".repeat(64) },
  });

  assert.equal(
    await hasMatchingPlanningSession(matchingRequest, localDevelopmentAuthContext),
    true,
  );
  assert.equal(
    await hasMatchingPlanningSession(staleRequest, localDevelopmentAuthContext),
    false,
  );
});
