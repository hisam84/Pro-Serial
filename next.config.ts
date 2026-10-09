import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM; keep it as a runtime dependency of the Node server
  // instead of bundling it into server chunks.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
