import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const logoDevVariableName = "NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY";

function asLogoDevPublishableKey(value: string | undefined) {
  const normalized = value?.trim().replace(/^(["'])(.*)\1$/, "$2");
  return normalized?.startsWith("pk_") ? normalized : undefined;
}

function readLocalLogoDevKey() {
  try {
    const line = readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .find((candidate) => candidate.trimStart().startsWith(`${logoDevVariableName}=`));

    return asLogoDevPublishableKey(line?.slice(line.indexOf("=") + 1));
  } catch {
    return undefined;
  }
}

const logoDevPublishableKey = Object.hasOwn(process.env, logoDevVariableName)
  ? asLogoDevPublishableKey(process.env[logoDevVariableName])
  : readLocalLogoDevKey();

const nextConfig: NextConfig = {
  env: logoDevPublishableKey
    ? { NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: logoDevPublishableKey }
    : undefined,
};

export default nextConfig;
import("@opennextjs/cloudflare").then((module) =>
  module.initOpenNextCloudflareForDev({ remoteBindings: false }),
);
