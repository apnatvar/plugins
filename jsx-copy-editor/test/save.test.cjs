const test = require('node:test');
const assert = require('node:assert/strict');
const { extractCopy } = require('../out/copy.js');
const { saveChanges } = require('../out/save.js');

const root = 'C:/save-fixture';
const normalizePath = (value) => value.replaceAll('\\', '/').replace(/^([A-Z]):/, (_, drive) => `${drive.toUpperCase()}:`);
const file = (name) => normalizePath(`${root}/${name}`);

async function snapshot(entries) {
  const files = Object.fromEntries(Object.entries(entries).map(([name, source]) => [file(name), source]));
  const result = await extractCopy({
    entryFile: file('src/App.tsx'),
    readFile: async (target) => files[normalizePath(target)],
  });
  return result;
}

function mockApi(currentFiles, applyResult = true) {
  const state = { applyCalls: 0, edits: [] };
  class Range {
    constructor(start, end) { this.start = start; this.end = end; }
  }
  class WorkspaceEdit {
    constructor() { this.replacements = []; }
    replace(uri, range, text) { this.replacements.push({ filePath: uri.fsPath, range, text }); }
  }
  const api = {
    Uri: { file: (fsPath) => ({ fsPath }) },
    Range,
    WorkspaceEdit,
    workspace: {
      async openTextDocument(uri) {
        const text = currentFiles[uri.fsPath];
        if (text === undefined) throw new Error(`Missing mock document: ${uri.fsPath}`);
        return {
          uri,
          getText: () => text,
          positionAt: (offset) => ({ offset }),
        };
      },
      async applyEdit(edit) {
        state.applyCalls += 1;
        state.edits.push(edit);
        if (applyResult) {
          const byFile = new Map();
          for (const replacement of edit.replacements) {
            const edits = byFile.get(replacement.filePath) ?? [];
            edits.push(replacement);
            byFile.set(replacement.filePath, edits);
          }
          for (const [filePath, replacements] of byFile) {
            currentFiles[filePath] = replacements
              .slice()
              .sort((a, b) => b.range.start.offset - a.range.start.offset)
              .reduce((source, replacement) => source.slice(0, replacement.range.start.offset)
                + replacement.text
                + source.slice(replacement.range.end.offset), currentFiles[filePath]);
          }
        }
        return applyResult;
      },
    },
  };
  return { api, state, currentFiles };
}

test('saves edits across files in one WorkspaceEdit with exact source offsets', async () => {
  const appSource = `import Child from './Child';\nexport default function App() { return <><h1>App title</h1><Child /></>; }`;
  const childSource = `export default function Child() { return <p>Child label</p>; }`;
  const result = await snapshot({ 'src/App.tsx': appSource, 'src/Child.tsx': childSource });
  const app = result.items.find((item) => item.text === 'App title');
  const child = result.items.find((item) => item.text === 'Child label');
  assert.ok(app && child);
  const { api, state, currentFiles } = mockApi({ ...result.files });

  await saveChanges(api, result, [
    { id: app.id, text: 'Updated title' },
    { id: child.id, text: 'Updated label' },
  ]);

  assert.equal(state.applyCalls, 1);
  assert.equal(state.edits.length, 1);
  const replacements = state.edits[0].replacements;
  assert.equal(replacements.length, 2);
  assert.deepEqual(new Set(replacements.map((edit) => normalizePath(edit.filePath))), new Set([app.filePath, child.filePath]));
  assert.deepEqual(new Set(replacements.map((edit) => edit.text)), new Set(['Updated title', 'Updated label']));
  const byText = new Map(result.items.map((item) => [item.text, item]));
  for (const replacement of replacements) {
    const item = byText.get(replacement.text === 'Updated title' ? 'App title' : 'Child label');
    assert.ok(replacement.range instanceof api.Range);
    assert.equal(replacement.range.start.offset, item.start);
    assert.equal(replacement.range.end.offset, item.end);
  }
  const appPath = Object.keys(result.files).find((path) => normalizePath(path).endsWith('/src/App.tsx'));
  const childPath = Object.keys(result.files).find((path) => normalizePath(path).endsWith('/src/Child.tsx'));
  assert.equal(currentFiles[appPath], `import Child from './Child';\nexport default function App() { return <><h1>Updated title</h1><Child /></>; }`);
  assert.equal(currentFiles[childPath], `export default function Child() { return <p>Updated label</p>; }`);
});

test('rejects stale editor contents before applying any workspace edit', async () => {
  const result = await snapshot({
    'src/App.tsx': `export default function App() { return <p>Original copy</p>; }`,
  });
  const item = result.items[0];
  const currentFiles = { ...result.files, [item.filePath]: result.files[item.filePath].replace('Original', 'External') };
  const { api, state } = mockApi(currentFiles);

  await assert.rejects(saveChanges(api, result, [{ id: item.id, text: 'Edited copy' }]), /stale|changed|source/i);
  assert.equal(state.applyCalls, 0);
});

test('reports when VS Code declines the grouped edit', async () => {
  const result = await snapshot({
    'src/App.tsx': `export default function App() { return <p>Original copy</p>; }`,
  });
  const item = result.items[0];
  const { api, state } = mockApi(result.files, false);

  await assert.rejects(saveChanges(api, result, [{ id: item.id, text: 'Edited copy' }]), /could not apply/i);
  assert.equal(state.applyCalls, 1);
});

test('skips WorkspaceEdit for unchanged copy', async () => {
  const result = await snapshot({
    'src/App.tsx': `export default function App() { return <p>Original copy</p>; }`,
  });
  const item = result.items[0];
  const { api, state } = mockApi(result.files);

  await saveChanges(api, result, [{ id: item.id, text: item.text }]);
  assert.equal(state.applyCalls, 0);
});
