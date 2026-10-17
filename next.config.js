const os = require("node:os");
const { tracingIgnores } = require("./scripts/tracing-ignores.cjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    outputFileTracingRoot: __dirname,
    // Operator-selected OpenClaw configuration is runtime data, not a package asset.
    // Ignore before NFT globs it; post-trace excludes cannot prevent Windows EPERM.
    outputFileTracingIgnores: tracingIgnores(__dirname, os.homedir()),
  },
};
module.exports = nextConfig;
