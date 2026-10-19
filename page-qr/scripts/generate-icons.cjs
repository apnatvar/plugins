#!/usr/bin/env node
// Rebuild the extension and store listing icons from icons/page-qr.svg.
// Install sharp in this project, or set SHARP_MODULE to its module entry point.
// Standard Node module lookup (including NODE_PATH) is also supported.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'icons', 'page-qr.svg');
const sharpModule = process.env.SHARP_MODULE
  ? path.resolve(process.env.SHARP_MODULE)
  : 'sharp';
const sharp = require(sharpModule);

async function main() {
  const svg = fs.readFileSync(source);
  const outputs = [
    ...[16, 32, 48, 128, 512].map(size => ({
      size,
      file: path.join(root, 'icons', `icon-${size}.png`),
    })),
    { size: 128, file: path.join(root, 'store-assets', 'logo-128.png') },
    { size: 512, file: path.join(root, 'store-assets', 'logo-512.png') },
  ];

  for (const { size, file } of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const artworkSize = Math.round(size * 0.75);
    const artwork = await sharp(svg, { density: 144 })
      .resize(artworkSize, artworkSize, { fit: 'fill' })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: artwork,
        left: Math.floor((size - artworkSize) / 2),
        top: Math.floor((size - artworkSize) / 2),
      }])
      .png()
      .toFile(file);
    process.stdout.write(`${path.relative(root, file)} ${size}x${size}\n`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
