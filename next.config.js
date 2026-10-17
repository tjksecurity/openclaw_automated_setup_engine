const path = require("node:path");
const os = require("node:os");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    outputFileTracingRoot: __dirname,
    // Operator-selected OpenClaw configuration is runtime data, not a package asset.
    // Ignore before NFT globs it; post-trace excludes cannot prevent Windows EPERM.
    outputFileTracingIgnores: [path.relative(__dirname, os.homedir()).replace(/\\/g, "/") + "/**/*"],
  },
};
module.exports = nextConfig;
