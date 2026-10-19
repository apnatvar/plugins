const test = require('node:test');
const assert = require('node:assert/strict');
const { extractCopy, planCopyEdits } = require('../out/copy.js');

const root = 'C:/fixture';
const normalizePath = (value) => value.replaceAll('\\', '/').replace(/^([A-Z]):/, (_, drive) => `${drive.toUpperCase()}:`);
const file = (name) => normalizePath(`${root}/${name}`);
const sourceFor = (files, filePath) => files[Object.keys(files).find((key) => normalizePath(key) === normalizePath(filePath))];

function fixture(entries) {
  const files = Object.fromEntries(
    Object.entries(entries).map(([name, source]) => [file(name), source]),
  );
  return {
    files,
    readFile: async (target) => {
      const key = normalizePath(target);
      return files[key];
    },
  };
}

async function extract(entries, entry = 'src/App.tsx') {
  const fs = fixture(entries);
  return { ...(await extractCopy({ entryFile: file(entry), readFile: fs.readFile })), fixture: fs };
}

function applyReplacements(source, replacements) {
  return replacements
    .slice()
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
}

test('extracts JSX text from direct JSX returns in .jsx and .tsx modules', async () => {
  const { items, fixture: fs } = await extract({
    'src/App.tsx': `import Other from './Other';
export default function App() {
  return <main><h1>Welcome home</h1><p>Read the guide</p><Other /></main>;
}`,
    'src/Other.jsx': `export default function Other() { return <button>Continue</button>; }`,
  });

  const texts = items.map((item) => item.text);
  assert.ok(texts.includes('Welcome home'));
  assert.ok(texts.includes('Read the guide'));
  assert.ok(texts.includes('Continue'));
  assert.ok(items.every((item) => typeof item.id === 'string' && item.id.length > 0));
  assert.ok(items.every((item) => typeof item.filePath === 'string' && item.filePath.length > 0));
  assert.ok(items.every((item) => Number.isInteger(item.start) && Number.isInteger(item.end) && item.start < item.end));
  assert.ok(items.every((item) => typeof item.original === 'string'));
  assert.ok(items.every((item) => sourceFor(fs.files, item.filePath).slice(item.start, item.end) === item.original));
});

test('follows default and named JSX imports through a directory index module', async () => {
  const { items } = await extract({
    'src/App.tsx': `import Panel, { Footer } from './parts';
export default () => <><Panel /><Footer /></>;`,
    'src/parts/index.tsx': `export default function Panel() { return <section>Panel copy</section>; }
export function Footer() { return <footer>Footer copy</footer>; }`,
  });

  assert.deepEqual(new Set(items.map((item) => item.text)), new Set(['Panel copy', 'Footer copy']));
});

test('deduplicates repeated imports and terminates on actual component cycles', async () => {
  const { items } = await extract({
    'src/App.tsx': `import Card from './Card';
import Again from './Card';
export default function App() { return <main>App label<Card /><Again /></main>; }`,
    'src/Card.tsx': `import App from './App';
export default function Card() { return <article>One card label<App /></article>; }`,
  });

  assert.equal(items.filter((item) => item.text === 'App label').length, 1);
  assert.equal(items.filter((item) => item.text === 'One card label').length, 1);
});

test('ignores dynamic expressions, conditional branches, maps, nested functions, and attributes', async () => {
  const { items } = await extract({
    'src/App.tsx': `export default function App({ user, rows }) {
  function nested() { return <aside>Nested function copy</aside>; }
  return <main title="Attribute copy">
    <h1>Visible title</h1>
    {user.name}
    {user ? <p>Conditional copy</p> : <p>Alternate copy</p>}
    {rows.map((row) => <span key={row.id}>Mapped copy</span>)}
    {nested()}
  </main>;
}`,
  });

  assert.deepEqual(items.map((item) => item.text), ['Visible title']);
});

test('skips a component whose only JSX return is conditional', async () => {
  const { items } = await extract({
    'src/App.tsx': `export default function App({ user }) {
  if (user) return <p>Conditional return copy</p>;
  return user ? <p>Conditional expression copy</p> : null;
}`,
  });

  assert.deepEqual(items, []);
});

test('skips an imported component with a parse error and keeps valid entry copy', async () => {
  const { items, diagnostics } = await extract({
    'src/App.tsx': `import Broken from './Broken';
export default function App() { return <main>Valid entry copy<Broken /></main>; }`,
    'src/Broken.tsx': `export default function Broken() { return <p>Broken copy</span>; }`,
  });

  assert.deepEqual(items.map((item) => item.text), ['Valid entry copy']);
  assert.ok(diagnostics.some((diagnostic) => /malformed|parse/i.test(diagnostic)));
});

test('decodes common named and numeric entities while retaining original entity spelling', async () => {
  const { items, fixture: fs } = await extract({
    'src/App.tsx': `export default function App() { return <p>A&copy;&mdash;&#10;世界 &amp; &lt; &gt;</p>; }`,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'A©—\n世界 & < >');
  assert.equal(items[0].original, 'A&copy;&mdash;&#10;世界 &amp; &lt; &gt;');
  assert.equal(
    planCopyEdits({ items, files: fs.files }, [{ id: items[0].id, text: items[0].text }], fs.files).length,
    0,
    'unchanged decoded text should leave the original entity spellings untouched',
  );
});

test('plans an edit that changes only the selected source range and escapes JSX text safely', async () => {
  const { items, fixture: fs } = await extract({
    'src/App.tsx': `const marker = "leave & keep";\nexport default function App() { return <p>Old &amp; safe</p>; }\n`,
  });
  const selected = items.find((item) => item.text === 'Old & safe');
  assert.ok(selected, 'expected extracted JSX text item');

  const replacements = planCopyEdits(
    { items, files: fs.files },
    [{ id: selected.id, text: 'New {value} & <safe> 世界' }],
    fs.files,
  );

  assert.equal(replacements.length, 1);
  assert.equal(replacements[0].filePath, selected.filePath);
  assert.deepEqual(replacements[0], {
    filePath: selected.filePath,
    start: selected.start,
    end: selected.end,
    text: 'New &#123;value&#125; &amp; &lt;safe&gt; 世界',
  });
  const changed = applyReplacements(sourceFor(fs.files, selected.filePath), replacements);
  assert.equal(changed, `const marker = "leave & keep";\nexport default function App() { return <p>New &#123;value&#125; &amp; &lt;safe&gt; 世界</p>; }\n`);
  assert.equal(changed.slice(0, selected.start), sourceFor(fs.files, selected.filePath).slice(0, selected.start));
});

test('preserves JSX layout around multiline edits and emits no edit for unchanged copy', async () => {
  const source = `export default function App() { return <p>\n      Old &amp; copy\n    </p>; }`;
  const { items, fixture: fs } = await extract({ 'src/App.tsx': source });
  const selected = items.find((item) => item.text === 'Old & copy');
  assert.ok(selected);

  const noOp = planCopyEdits(
    { items, files: fs.files },
    [{ id: selected.id, text: selected.text }],
    fs.files,
  );
  assert.deepEqual(noOp, []);

  const replacements = planCopyEdits(
    { items, files: fs.files },
    [{ id: selected.id, text: 'New {value} & copy' }],
    fs.files,
  );
  const changed = applyReplacements(sourceFor(fs.files, selected.filePath), replacements);
  assert.match(changed, /<p>\n\s+New &#123;value&#125; &amp; copy\n\s+<\/p>/);
  const updated = await extract({ 'src/App.tsx': changed });
  assert.equal(updated.items.find((item) => item.text.includes('New'))?.text, 'New {value} & copy');
});

test('rejects stale source and invalid item identifiers', async () => {
  const { items, fixture: fs } = await extract({
    'src/App.tsx': `export default function App() { return <p>Original text</p>; }`,
  });
  const selected = items[0];
  const selectedPath = Object.keys(fs.files).find((key) => normalizePath(key) === normalizePath(selected.filePath));
  const staleFiles = { ...fs.files, [selectedPath]: sourceFor(fs.files, selected.filePath).replace('Original', 'Changed!') };

  assert.throws(
    () => planCopyEdits({ items, files: fs.files }, [{ id: selected.id, text: 'Replacement' }], staleFiles),
    /stale|changed|source/i,
  );
  assert.throws(
    () => planCopyEdits({ items, files: fs.files }, [{ id: 'missing-item', text: 'Replacement' }], fs.files),
    /invalid|unknown|item|id/i,
  );
});

test('roundtrips edited line breaks and JSX-sensitive text while preserving outer CRLF layout', async () => {
  const source = 'export default () => <p>\r\n  Old copy\r\n</p>;';
  const { items, files } = await extract({ 'src/App.tsx': source });
  const text = 'Line one\n{two} & <three> ©';
  const replacements = planCopyEdits({ items, files }, [{ id: items[0].id, text }], files);
  const changed = applyReplacements(source, replacements);
  assert.equal(changed, 'export default () => <p>\r\n  Line one&#10;&#123;two&#125; &amp; &lt;three&gt; ©\r\n</p>;');
  const updated = await extract({ 'src/App.tsx': changed });
  assert.equal(updated.items[0].text, text);
});

test('plans edits in more than one file', async () => {
  const { items, fixture: fs } = await extract({
    'src/App.tsx': `import Child from './Child';\nexport default function App() { return <><h1>App title</h1><Child /></>; }`,
    'src/Child.tsx': `export default function Child() { return <p>Child label</p>; }`,
  });
  const title = items.find((item) => item.text === 'App title');
  const child = items.find((item) => item.text === 'Child label');
  assert.ok(title && child);

  const replacements = planCopyEdits(
    { items, files: fs.files },
    [{ id: title.id, text: 'New app title' }, { id: child.id, text: 'New child label' }],
    fs.files,
  );
  assert.deepEqual(new Set(replacements.map((edit) => edit.filePath)), new Set([title.filePath, child.filePath]));
  assert.equal(replacements.length, 2);
  for (const [filePath, source] of Object.entries(fs.files)) {
    const fileEdits = replacements.filter((edit) => edit.filePath === filePath);
    if (!fileEdits.length) continue;
    const updated = applyReplacements(source, fileEdits);
    assert.ok(updated.includes(normalizePath(filePath) === normalizePath(title.filePath) ? 'New app title' : 'New child label'));
  }
});
