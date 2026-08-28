import { getPlatformProxy } from "wrangler";

import { provisionPilotIdentity } from "../server/identity/provision-pilot.ts";

const modes = process.argv.slice(2).filter((argument) =>
  ["--local", "--remote"].includes(argument),
);

if (modes.length !== 1) {
  throw new Error("Choose exactly one target: --local or --remote.");
}

const email = process.env.PILOT_EMAIL;
const providerSubject = process.env.PILOT_ACCESS_SUBJECT;

if (!email || !providerSubject) {
  throw new Error("PILOT_EMAIL and PILOT_ACCESS_SUBJECT must be set in the shell.");
}

const remote = modes[0] === "--remote";
const platform = await getPlatformProxy<CloudflareEnv>({
  configPath: "wrangler.jsonc",
  persist: remote ? false : true,
  remoteBindings: remote,
});

try {
  const result = await provisionPilotIdentity(platform.env.FAMEKO_DB, {
    displayName: process.env.PILOT_DISPLAY_NAME,
    email,
    householdName: process.env.PILOT_HOUSEHOLD_NAME,
    providerSubject,
  });

  console.log(`Pilot provisioned in ${remote ? "remote" : "local"} D1.`);
  console.log(`User ID: ${result.userId}`);
  console.log(`Household ID: ${result.householdId}`);
  console.log(`Auth identity ID: ${result.authIdentityId}`);
} finally {
  await platform.dispose();
}
