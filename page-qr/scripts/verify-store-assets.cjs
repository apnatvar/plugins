const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
function png(file, side) {
  const data = read(file);
  assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16), side, file + ': width');
  assert.equal(data.readUInt32BE(20), side, file + ': height');
}
function jpeg(file) {
  const data = read(file);
  assert.equal(data.readUInt16BE(0), 0xffd8);
  let offset = 2;
  while (offset < data.length) {
    assert.equal(data[offset++], 0xff);
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    const size = data.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      assert.equal(data.readUInt16BE(offset + 3), 800, file + ': height');
      assert.equal(data.readUInt16BE(offset + 5), 1280, file + ': width');
      return;
    }
    offset += size;
  }
  assert.fail('JPEG dimensions not found: ' + file);
}
for (const side of [16, 32, 48, 128, 512]) png(`icons/icon-${side}.png`, side);
png('store-assets/logo-512.png', 512);
png('store-assets/logo-128.png', 128);
jpeg('store-assets/screenshot-01-generate.jpg');
jpeg('store-assets/screenshot-02-download.jpg');
const extended = read('store-assets/DESCRIPTION_3000_WORDS.md').toString('utf8');
assert.equal(extended.trim().split(/\s+/).length, 3000);
const concise = read('store-assets/DESCRIPTION_STORE.txt').toString('utf8');
assert.ok(concise.length < 16000, 'Keep the concise listing text below 16,000 characters');
for (const text of [extended, concise]) {
  assert.ok(text.includes('https://brownsmithdynamics.com'));
  assert.ok(text.includes('https://plugins.brownsmithdynamics.com/support/'));
}
const manifest = JSON.parse(read('manifest.json'));
const urls = JSON.parse(read('store-assets/LISTING_URLS.json'));
assert.equal(manifest.homepage_url, urls.homepage);
assert.equal(urls.support, 'https://plugins.brownsmithdynamics.com/support/');
for (const [side, file] of Object.entries(manifest.icons)) png(file, Number(side));
console.log('Store assets verified: 2 screenshots at 1280x800; 128px store logo; manifest icons; 3,000-word description; configured subdomain URLs.');
