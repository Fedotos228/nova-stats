// Standalone CJS worker: loads the ESRGAN model once and upscales a batch of images.
// Run as its own `node` process (see app/lib/weather-scraper.ts) so the CJS-only
// upscaler/tfjs-node packages don't have to interoperate with Next.js's own bundling.
const fs = require("fs")

// @tensorflow/tfjs-node's prebuilt native bindings call a `util` helper that Node removed in v20+.
const util = require("util")
if (!util.isNullOrUndefined) {
  util.isNullOrUndefined = (v) => v === null || v === undefined
}

require("@tensorflow/tfjs-node")
const UpscalerJS = require("upscaler/node")
const model = require("@upscalerjs/esrgan-slim/4x")
const sharp = require("sharp")

async function main() {
  const manifestPath = process.argv[2]
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

  const upscaler = new UpscalerJS({ model })

  for (const { input, output } of manifest) {
    const buffer = fs.readFileSync(input)
    const tensor = await upscaler.upscale(buffer, { output: "tensor" })
    const [height, width, channels] = tensor.shape
    const pixels = Buffer.from(Uint8Array.from(await tensor.data()))
    tensor.dispose()

    await sharp(pixels, { raw: { width, height, channels } }).png().toFile(output)
    console.log(`upscaled ${input} -> ${output}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
