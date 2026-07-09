import { createRequire } from "module"
import util from "util"

// upscaler/node and @upscalerjs/esrgan-slim/4x are CJS-only (no "import" export condition),
// and @tensorflow/tfjs-node ships a native binary — all three are marked as
// serverExternalPackages (next.config.ts) so Next.js leaves them as plain `require()`s that
// resolve against the real node_modules tree instead of trying to bundle them.
const require = createRequire(import.meta.url)

// @tensorflow/tfjs-node's prebuilt native bindings call a `util` helper Node removed in v20+.
const nodeUtil = util as unknown as { isNullOrUndefined?: (v: unknown) => boolean }
if (!nodeUtil.isNullOrUndefined) {
  nodeUtil.isNullOrUndefined = (v) => v === null || v === undefined
}

require("@tensorflow/tfjs-node")
const UpscalerJS = require("upscaler/node")
const model = require("@upscalerjs/esrgan-slim/4x")
const sharp = require("sharp")

let upscaler: InstanceType<typeof UpscalerJS> | null = null

export async function upscaleImage(buffer: Buffer): Promise<Buffer> {
  upscaler ??= new UpscalerJS({ model })

  const tensor = await upscaler.upscale(buffer, { output: "tensor" })
  const [height, width, channels] = tensor.shape as [number, number, number]
  const pixels = Buffer.from(Uint8Array.from(await tensor.data()))
  tensor.dispose()

  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer()
}
