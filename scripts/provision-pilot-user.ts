import { getPlatformProxy } from "wrangler";

import { provisionPilotIdentity } from "../server/identity/provision-pilot.ts";

const arguments_ = process.argv.slice(2);
const modes = arguments_.filter((argument) =>
  ["--local", "--remote"].includes(argument),
);
const verifyTargetOnly = arguments_.includes("--verify-target");
const unsupportedArguments = arguments_.filter(
  (argument) =>
    !["--local", "--remote", "--verify-target"].includes(argument),
);

if (modes.length !== 1 || unsupportedArguments.length > 0) {
  throw new Error("Choose exactly one target: --local or --remote.");
}

const email = process.env.PILOT_EMAIL;
const providerSubject = process.env.PILOT_ACCESS_SUBJECT;

if (!verifyTargetOnly && (!email || !providerSubject)) {
  throw new Error("PILOT_EMAIL and PILOT_ACCESS_SUBJECT must be set in the shell.");
}

const remote = modes[0] === "--remote";
const platform = await getPlatformProxy<CloudflareEnv>({
  configPath: "wrangler.jsonc",
  persist: remote ? false : true,
  remoteBindings: remote,
});

try {
  const schema = await platform.env.FAMEKO_DB.prepare(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name IN (
         'users',
         'auth_identities',
         'households',
         'household_members',
         'planning_years'
       )`,
  ).all<{ name: string }>();
  const existingTables = new Set(schema.results.map((row) => row.name));
  const requiredTables = [
    "users",
    "auth_identities",
    "households",
    "household_members",
    "planning_years",
  ];
  const missingTables = requiredTables.filter(
    (table) => !existingTables.has(table),
  );

  if (missingTables.length > 0) {
    throw new Error(
      `${remote ? "Remote" : "Local"} D1 target is missing required tables: ${missingTables.join(", ")}.`,
    );
  }

  if (verifyTargetOnly) {
    console.log(
      `Verified ${remote ? "remote" : "local"} D1 target with the identity schema.`,
    );
  } else {
    const result = await provisionPilotIdentity(platform.env.FAMEKO_DB, {
      displayName: process.env.PILOT_DISPLAY_NAME,
      email: email!,
      householdName: process.env.PILOT_HOUSEHOLD_NAME,
      providerSubject: providerSubject!,
    });

    console.log(`Pilot provisioned in ${remote ? "remote" : "local"} D1.`);
    console.log(`User ID: ${result.userId}`);
    console.log(`Household ID: ${result.householdId}`);
    console.log(`Auth identity ID: ${result.authIdentityId}`);
  }
} finally {
  await platform.dispose();
}
