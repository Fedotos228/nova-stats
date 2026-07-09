import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The refresh-weather route spawns scripts/upscale-images.cjs as a subprocess (not a
  // static import), so Next's build tracer can't see it needs @tensorflow/tfjs-node's
  // native binary, upscaler, or sharp — force them into the deployed function bundle.
  outputFileTracingIncludes: {
    "/api/refresh-weather": [
      "./scripts/upscale-images.cjs",
      "./node_modules/@tensorflow/tfjs-node/**/*",
      "./node_modules/upscaler/**/*",
      "./node_modules/@upscalerjs/esrgan-slim/**/*",
      "./node_modules/sharp/**/*",
    ],
  },
};

export default nextConfig;
