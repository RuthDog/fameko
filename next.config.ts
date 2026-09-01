import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const logoDevVariableName = "NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY";

function asLogoDevPublishableKey(value: string | undefined) {
  const normalized = value?.trim().replace(/^(["'])(.*)\1$/, "$2");
  return normalized?.startsWith("pk_") ? normalized : undefined;
}

function readDevelopmentLogoDevKey() {
  if (process.env.NODE_ENV !== "development") {
    return undefined;
  }

  try {
    const line = readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .find((candidate) => candidate.trimStart().startsWith(`${logoDevVariableName}=`));

    return asLogoDevPublishableKey(line?.slice(line.indexOf("=") + 1));
  } catch {
    return undefined;
  }
}

const logoDevPublishableKey =
  asLogoDevPublishableKey(process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY) ??
  readDevelopmentLogoDevKey();

const nextConfig: NextConfig = {
  env: logoDevPublishableKey
    ? { NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: logoDevPublishableKey }
    : undefined,
};

export default nextConfig;
import("@opennextjs/cloudflare").then((module) =>
  module.initOpenNextCloudflareForDev({ remoteBindings: false }),
);
