import type { SitemapDiff, SitemapEntry } from './types.js';

function sanitize(value: string): string {
  return value.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '�');
}

function escapeCell(value: string): string {
  return sanitize(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/([`*_{}\[\]()#+.!~-])/g, '\\$1')
    .replace(/[\r\n]+/g, '<br>');
}

function row(cells: string[]): string {
  return `| ${cells.map(escapeCell).join(' | ')} |`;
}

function separator(columnCount: number): string {
  return `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;
}

function renderEntry(entry: SitemapEntry): string {
  const metadata = [entry.lastmod, entry.changefreq, entry.priority].filter((value): value is string => value !== undefined);
  return [entry.loc, ...metadata].join(' · ');
}

/** Serialize a diff as stable, valid JSON. */
export function toJsonReport(diff: SitemapDiff, space = 2): string {
  if (!Number.isInteger(space) || space < 0 || space > 10) {
    throw new RangeError('JSON indentation must be an integer from 0 to 10');
  }
  return JSON.stringify(diff, (_key, value: unknown) => typeof value === 'string' ? sanitize(value) : value, space);
}

/** Render a human-readable Markdown report with data escaped for table cells. */
export function toMarkdownReport(diff: SitemapDiff): string {
  const lines = [
    '# Sitemap diff',
    '',
    `Added: ${diff.summary.added} · Removed: ${diff.summary.removed} · Changed: ${diff.summary.changed} · Unchanged: ${diff.summary.unchanged}`,
    `Duplicate entries: before ${diff.summary.duplicatesBefore} · after ${diff.summary.duplicatesAfter}`,
  ];

  lines.push('', '## Added', '', row(['URL', 'Last modified', 'Change frequency', 'Priority']), separator(4));
  for (const entry of diff.added) lines.push(row([entry.loc, entry.lastmod ?? '', entry.changefreq ?? '', entry.priority ?? '']));
  if (diff.added.length === 0) lines.push(row(['None', '', '', '']));

  lines.push('', '## Removed', '', row(['URL', 'Last modified', 'Change frequency', 'Priority']), separator(4));
  for (const entry of diff.removed) lines.push(row([entry.loc, entry.lastmod ?? '', entry.changefreq ?? '', entry.priority ?? '']));
  if (diff.removed.length === 0) lines.push(row(['None', '', '', '']));

  lines.push('', '## Changed', '', row(['URL', 'Field', 'Before', 'After']), separator(4));
  for (const item of diff.changed) {
    for (const [field, values] of Object.entries(item.fields)) {
      lines.push(row([item.url, field, values.before ?? '', values.after ?? '']));
    }
  }
  if (diff.changed.length === 0) lines.push(row(['None', '', '', '']));

  for (const side of ['before', 'after'] as const) {
    const groups = diff.duplicates[side];
    lines.push('', `## Duplicates (${side})`, '', row(['Normalized URL', 'Entries']), separator(2));
    for (const group of groups) lines.push(row([group.url, group.entries.map(renderEntry).join('; ')]));
    if (groups.length === 0) lines.push(row(['None', '']));
  }
  return `${lines.join('\n')}\n`;
}
