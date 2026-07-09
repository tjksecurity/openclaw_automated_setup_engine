/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained Node server bundle under .next/standalone. The
  // bin script (bin/openclaw-setup-engine.js) runs it directly with node.
  output: "standalone",
};

module.exports = nextConfig;
