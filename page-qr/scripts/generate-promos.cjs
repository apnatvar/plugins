#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'store-assets', 'promo-source');
const logoPath = path.join(root, 'icons', 'page-qr.svg');
const logoData = `data:image/svg+xml;base64,${fs.readFileSync(logoPath).toString('base64')}`;

const marqueeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1400" height="560" viewBox="0 0 1400 560">
  <title>Page QR — Share the page you’re on</title>
  <rect width="1400" height="560" fill="#F7F3E8"/>
  <path d="M900 0h500v560H900z" fill="#103F43"/>
  <path d="M873 0h27v560h-27z" fill="#D96E4B"/>
  <circle cx="1186" cy="280" r="232" fill="#1B5053"/>
  <circle cx="1186" cy="280" r="196" fill="none" stroke="#6E9790" stroke-width="1.5" opacity=".7"/>
  <path d="M1023 62h326v436h-326z" fill="none" stroke="#F7F3E8" stroke-width="1.5" opacity=".22"/>
  <image x="1000" y="94" width="372" height="372" preserveAspectRatio="xMidYMid meet" href="${logoData}" xlink:href="${logoData}"/>
  <text x="100" y="142" fill="#103F43" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="3">A QUICKER WAY TO PASS IT ON</text>
  <text x="96" y="270" fill="#103F43" font-family="Segoe UI, Arial, sans-serif" font-size="100" font-weight="750" letter-spacing="-5">Page QR</text>
  <text x="101" y="335" fill="#31595A" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="400">Share the page you’re on.</text>
  <text x="101" y="397" fill="#31595A" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="400">Full links. Local generation.</text>
  <path d="M101 444h60" stroke="#D96E4B" stroke-width="5" stroke-linecap="round"/>
  <text x="101" y="491" fill="#103F43" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="650">BROWNSMITH DYNAMICS</text>
  <text x="101" y="527" fill="#537273" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="400">brownsmithdynamics.com</text>
</svg>`;

const smallSvg = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="440" height="280" viewBox="0 0 440 280">
  <title>Page QR by Brownsmith Dynamics</title>
  <rect width="440" height="280" fill="#103F43"/>
  <path d="M0 0h440v14H0z" fill="#D96E4B"/>
  <circle cx="354" cy="82" r="79" fill="#1B5053"/>
  <circle cx="354" cy="82" r="66" fill="none" stroke="#83A9A0" stroke-width="1.5" opacity=".65"/>
  <image x="302" y="30" width="104" height="104" preserveAspectRatio="xMidYMid meet" href="${logoData}" xlink:href="${logoData}"/>
  <text x="34" y="75" fill="#F7F3E8" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">BROWNSMITH DYNAMICS</text>
  <text x="31" y="151" fill="#F7F3E8" font-family="Segoe UI, Arial, sans-serif" font-size="58" font-weight="750" letter-spacing="-2.6">Page QR</text>
  <text x="35" y="190" fill="#D6E3DB" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="400">This page. Ready to share.</text>
  <path d="M35 221h370" stroke="#5D817D" stroke-width="1"/>
  <text x="35" y="250" fill="#F2A080" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing=".1">Save as PNG. Copy as image.</text>
</svg>`;

async function writePromo(name, outputName, svg, width, height) {
  const svgPath = path.join(sourceDir, name);
  fs.writeFileSync(svgPath, `${svg.trim()}\n`, 'utf8');
  return sharp(Buffer.from(svg)).png().resize(width, height).toFile(path.join(root, 'store-assets', outputName));
}

async function main() {
  fs.mkdirSync(sourceDir, { recursive: true });
  await Promise.all([
    writePromo('marquee.svg', 'marquee-1400x560.png', marqueeSvg, 1400, 560),
    writePromo('small.svg', 'small-promo-440x280.png', smallSvg, 440, 280),
  ]);
  process.stdout.write('Generated 1400×560 marquee and 440×280 small promo assets.\n');
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
