import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These use Node-specific features (a native binary, or CJS-only exports) that Next's
  // own bundler mishandles — left as plain `require()`s, the build's file tracer can
  // follow their real dependency graph (including transitive deps) automatically.
  serverExternalPackages: ["@tensorflow/tfjs-node", "upscaler", "@upscalerjs/esrgan-slim"],
};

export default nextConfig;
