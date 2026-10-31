import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
import("@opennextjs/cloudflare").then((module) =>
  module.initOpenNextCloudflareForDev({ remoteBindings: false }),
);
