// Dependency-free smoke/behavior checks for the unpacked Chrome extension.
// Run with: node tests/verify.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function checkManifest() {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3, 'extension must use Manifest V3');
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.deepEqual(manifest.permissions || [], ['activeTab'], 'only activeTab permission is needed');
  assert.deepEqual(manifest.host_permissions || [], [], 'extension must not request host access');

  const html = read('popup.html');
  assert.match(html, /<script\s+src=["']vendor\/qrcode\.js["']/i);
  assert.match(html, /<script\s+src=["']popup\.js["']/i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=["']https?:\/\//i, 'popup scripts must be local');
  assert.doesNotMatch(html, /<link\b[^>]*\bhref=["']https?:\/\//i, 'popup styles must be local');
  assert.doesNotMatch(html, /@import\s+url\s*\(\s*["']?https?:/i);

  const css = read('popup.css');
  assert.doesNotMatch(css, /url\s*\(\s*["']?https?:/i, 'CSS must not load remote assets');
  assert.doesNotMatch(read('popup.js'), /https?:\/\//i, 'popup code must not call remote endpoints');
}

function makeElement(id = '') {
  const listeners = {};
  return {
    id,
    hidden: false,
    disabled: false,
    textContent: '',
    width: 0,
    height: 0,
    href: '',
    download: '',
    children: [],
    listeners,
    classList: { toggle() {} },
    addEventListener(type, callback) { listeners[type] = callback; },
    getContext(type) {
      if (type !== '2d') return null;
      const calls = [];
      this.drawCalls = calls;
      const textCalls = [];
      this.textCalls = textCalls;
      return {
        set fillStyle(value) { this._fillStyle = value; },
        get fillStyle() { return this._fillStyle; },
        set font(value) { this._font = value; },
        get font() { return this._font; },
        set textAlign(value) { this._textAlign = value; },
        get textAlign() { return this._textAlign; },
        set textBaseline(value) { this._textBaseline = value; },
        get textBaseline() { return this._textBaseline; },
        fillRect(...args) { calls.push({ fillStyle: this.fillStyle, args }); },
        fillText(...args) {
          textCalls.push({ fillStyle: this.fillStyle, font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline, args });
        },
      };
    },
    toBlob(callback, type) { callback({ type, size: 128, marker: 'fake-png' }); },
    appendChild(child) { this.children.push(child); },
    remove() { this.removed = true; },
    click() { this.clicked = true; },
  };
}

async function runPopup(tabUrl, options = {}) {
  const ids = ['qr-canvas', 'loading', 'error', 'page-url', 'feedback', 'download-button', 'copy-button', 'share-button'];
  const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));
  const objectUrls = new Set();
  const copied = [];
  const shared = [];
  const contextCalls = [];
  let queryCallback;
  const chrome = {
    tabs: {
      query(query, callback) {
        contextCalls.push(query);
        queryCallback = callback;
        callback(options.tabs === undefined ? (tabUrl ? [{ url: tabUrl }] : []) : options.tabs);
      },
    },
    runtime: { lastError: options.runtimeError || null },
  };
  const document = {
    getElementById(id) { return elements[id]; },
    createElement(tag) { return makeElement(tag); },
    body: { appendChild(node) { node.parent = this; this.children = this.children || []; this.children.push(node); } },
  };
  const navigator = {
    clipboard: { async write(items) {
      if (options.clipboardDenied) throw new Error('Clipboard unavailable');
      copied.push(...items);
    } },
  };
  class File { constructor(parts, name, settings) { Object.assign(this, { parts, name, ...settings }); } }
  if (options.sharing) {
    navigator.canShare = ({ files }) => files.length === 1;
    navigator.share = async (data) => { shared.push(data); };
  }
  class ClipboardItem { constructor(data) { this.data = data; } }
  class URLApi extends URL {
    static createObjectURL() { const value = `blob:test-${objectUrls.size + 1}`; objectUrls.add(value); return value; }
    static revokeObjectURL(value) { objectUrls.delete(value); }
  }
  const sandbox = {
    chrome, document, navigator, ClipboardItem, File, URL: URLApi,
    window: { setTimeout(callback) { callback(); return 1; } },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(read('vendor/qrcode.js'), sandbox, { filename: 'vendor/qrcode.js' });

  // Record the exact input and mode while still allowing the bundled encoder to
  // build a real symbol. This catches truncation, normalization, and wrong mode.
  const realQrFactory = sandbox.qrcode;
  const encodedInputs = [];
  const utf8Inputs = [];
  const originalUtf8 = realQrFactory.stringToBytesFuncs['UTF-8'];
  realQrFactory.stringToBytesFuncs['UTF-8'] = (value) => {
    const bytes = originalUtf8(value);
    utf8Inputs.push({ value, bytes: Array.from(bytes) });
    return bytes;
  };
  sandbox.qrcode = (...args) => {
    const qr = realQrFactory(...args);
    const addData = qr.addData.bind(qr);
    qr.addData = (data, mode) => { encodedInputs.push({ data, mode }); return addData(data, mode); };
    return qr;
  };
  sandbox.qrcode.stringToBytesFuncs = realQrFactory.stringToBytesFuncs;
  Object.defineProperty(sandbox.qrcode, 'stringToBytes', {
    get() { return realQrFactory.stringToBytes; },
    set(value) { realQrFactory.stringToBytes = value; },
  });
  vm.runInContext(read('popup.js'), sandbox, { filename: 'popup.js' });
  await new Promise((resolve) => setImmediate(resolve));
  return { elements, encodedInputs, utf8Inputs, objectUrls, copied, shared, document, contextCalls, queryCallback };
}

async function checkSuccessfulGenerationAndActions() {
  const urls = [
    'https://example.test/path?x=1&y=two#section',
    'https://例え.テスト/道?検索=雪&emoji=🌍#節',
    'https://portal.example.test/products/widget/details?ref=partner#specs',
    'https://team.eu.example.test/account/orders/42',
  ];
  for (const url of urls) {
    const result = await runPopup(url);
    assert.deepEqual(result.encodedInputs, [{ data: url, mode: 'Byte' }], 'QR must contain the complete URL in byte mode');
    assert.deepEqual(result.utf8Inputs[0], {
      value: url,
      bytes: Array.from(Buffer.from(url, 'utf8')),
    }, 'QR encoder must receive the URL as UTF-8 bytes');
    assert.equal(result.elements['page-url'].textContent, url);
    assert.equal(result.elements['loading'].hidden, true);
    assert.equal(result.elements['error'].hidden, true);
    assert.equal(result.elements['qr-canvas'].hidden, false);
    assert.ok(result.elements['qr-canvas'].drawCalls.length > 10, 'real QR modules should be drawn on canvas');
    const { width, height, drawCalls, textCalls } = result.elements['qr-canvas'];
    assert.equal(height, width + 40, 'branding footer adds 40px below the square QR');
    assert.equal(drawCalls[0].fillStyle, '#ffffff');
    assert.deepEqual(Array.from(drawCalls[0].args), [0, 0, width, height]);
    for (const { args: [x, y, w, h] } of drawCalls.slice(1)) {
      assert.equal(w, h);
      assert.ok(Number.isInteger(w) && w >= 4);
      assert.ok(x >= w * 4 && y >= h * 4, 'white quiet zone at top and left');
      assert.ok(x + w <= width - w * 4 && y + h <= width - h * 4, 'white quiet zone at bottom and right of QR square');
    }
    assert.deepEqual(textCalls, [{
      fillStyle: '#64748b',
      font: '500 12px system-ui, sans-serif',
      textAlign: 'center',
      textBaseline: 'middle',
      args: ['[BD] Brownsmith Dynamics', width / 2, width + 20, width - 24],
    }], 'branding must be centered in the footer below the QR quiet zone');
    assert.ok(result.elements['download-button'].disabled === false);

    await result.elements['download-button'].listeners.click();
    assert.equal(result.elements.feedback.textContent, 'PNG downloaded.');
    assert.equal(result.document.body.children[0].download, 'page-qr.png');
    assert.equal(result.document.body.children[0].clicked, true);
    assert.equal(result.objectUrls.size, 0, 'download object URL must be released');
    assert.equal(result.elements['share-button'].hidden, true);

    await result.elements['copy-button'].listeners.click();
    assert.equal(result.copied.length, 1, 'copy action should write the PNG to the clipboard');
    assert.equal(result.copied[0].data['image/png'].marker, 'fake-png');
  }
  const share = await runPopup('https://example.test/', { sharing: true });
  assert.equal(share.elements['share-button'].hidden, false);
  await share.elements['share-button'].listeners.click();
  assert.equal(share.shared.length, 1);
  assert.equal(share.shared[0].files[0].name, 'page-qr.png');
  assert.equal(share.shared[0].files[0].type, 'image/png');
  const denied = await runPopup('https://example.test/', { clipboardDenied: true });
  await denied.elements['copy-button'].listeners.click();
  assert.match(denied.elements.feedback.textContent, /Download the PNG instead/);
  assert.equal(denied.elements['copy-button'].disabled, false);
}

async function checkErrors() {
  const missing = await runPopup(null);
  assert.equal(missing.elements.error.hidden, false);
  assert.match(missing.elements.error.textContent, /address is unavailable/i);
  assert.equal(missing.elements['download-button'].disabled, true);

  const runtimeError = await runPopup('https://example.test/', { runtimeError: { message: 'tab access failed' } });
  assert.equal(runtimeError.elements.error.textContent, 'tab access failed');

  const long = await runPopup(`https://example.test/${'x'.repeat(5000)}`);
  assert.equal(long.elements.error.hidden, false);
  assert.match(long.elements.error.textContent, /too long/i);
  assert.equal(long.encodedInputs.length, 1);

  const unsupported = await runPopup('chrome://settings');
  assert.equal(unsupported.elements.error.hidden, false, 'browser-internal pages must be rejected');
  assert.equal(unsupported.encodedInputs.length, 0, 'unsupported page URLs must not be encoded');
}

(async () => {
  checkManifest();
  await checkSuccessfulGenerationAndActions();
  await checkErrors();
  process.stdout.write('Page QR verification passed.\n');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
