import * as ts from "typescript";

export type CopyItem = {
  id: string;
  filePath: string;
  start: number;
  end: number;
  /** Entity-decoded JSX text with React-style multiline whitespace normalization. */
  text: string;
  /** Exact source spelling, including JSX entities and whitespace. */
  original: string;
};

export type ExtractionResult = {
  items: CopyItem[];
  /** Source snapshots for the entry file and files reached through components. */
  files: Record<string, string>;
  diagnostics: string[];
};

export type CopyChange = { id: string; text: string };
export type PlannedReplacement = { filePath: string; start: number; end: number; text: string };
export type CopyFileReader = (filePath: string) => Promise<string | undefined>;

export async function extractCopy(options: {
  entryFile: string;
  readFile: CopyFileReader;
}): Promise<ExtractionResult> {
  const files: Record<string, string> = {};
  const diagnostics: string[] = [];
  const parsed = new Map<string, ts.SourceFile>();
  const processedComponents = new Set<string>();
  const itemsByKey = new Map<string, CopyItem>();

  const read = async (filePath: string): Promise<string | undefined> => {
    const key = normalizePath(filePath);
    if (Object.prototype.hasOwnProperty.call(files, key)) return files[key];
    const text = await options.readFile(key);
    if (text === undefined) return undefined;
    files[key] = text;
    return text;
  };

  const sourceFor = async (filePath: string): Promise<ts.SourceFile | undefined> => {
    const key = normalizePath(filePath);
    const existing = parsed.get(key);
    if (existing) return existing;
    const text = await read(key);
    if (text === undefined) return undefined;
    const source = createParsedSource(key, text);
    parsed.set(key, source);
    if (source.parseDiagnostics.length) {
      diagnostics.push(`Skipped malformed source: ${key}`);
      return undefined;
    }
    return source;
  };

  const visitComponent = async (filePath: string, requestedName?: string, requireExport = false): Promise<void> => {
    const key = normalizePath(filePath);
    const source = await sourceFor(key);
    if (!source) {
      diagnostics.push(`Could not read component source: ${key}`);
      return;
    }

    const componentKey = `${key}#${requestedName ?? "<entry>"}`;
    if (processedComponents.has(componentKey)) return;
    processedComponents.add(componentKey);

    const components = getComponents(source);
    const component = chooseComponent(components, requestedName, requireExport);
    if (!component) {
      diagnostics.push(`Could not identify a component${requestedName ? ` named ${requestedName}` : ""} in ${key}`);
      return;
    }

    const importTargets = await getImportTargets(source, key, options.readFile);
    const localNames = new Set(components.map((candidate) => candidate.name));
    for (const root of component.roots) {
      await walkJsx(root, async (element) => {
        const tag = getTagName(element.tagName);
        if (!tag || !/^[A-Z]/.test(tag)) return;
        const imported = importTargets.get(tag);
        if (imported) {
          await visitComponent(imported.filePath, imported.importedName, true);
        } else if (localNames.has(tag)) {
          await visitComponent(key, tag);
        }
      }, (node) => {
        const start = node.getStart(source);
        const end = node.getEnd();
        const original = source.text.slice(start, end);
        const itemKey = `${key}:${start}:${end}`;
        if (!itemsByKey.has(itemKey)) {
          if (hasUnsupportedNamedEntity(original)) {
            diagnostics.push(`Skipped JSX text with an unsupported named entity in ${key}:${start}`);
            return;
          }
          const text = decodeJsxEntities(normalizeJsxWhitespace(original));
          if (!text.replace(/[\t\r\n ]/g, "")) return;
          itemsByKey.set(itemKey, {
            id: itemKey,
            filePath: key,
            start,
            end,
            text,
            original,
          });
        }
      });
    }
  };

  const entry = normalizePath(options.entryFile);
  const entrySource = await sourceFor(entry);
  if (!entrySource) {
    if (Object.prototype.hasOwnProperty.call(files, entry)) throw new Error(`Could not parse entry file: ${entry}`);
    throw new Error(`Could not read entry file: ${entry}`);
  }
  const entryComponent = chooseComponent(getComponents(entrySource));
  if (!entryComponent) {
    diagnostics.push(`Could not identify a component in ${entry}`);
  } else {
    await visitComponent(entry, entryComponent.name);
  }

  return { items: [...itemsByKey.values()], files, diagnostics };
}

/**
 * Build source replacements from edited UI values. Every changed file must still
 * match the extraction snapshot, and each saved span must still be a JSXText node.
 */
export function planCopyEdits(
  result: ExtractionResult,
  changes: CopyChange[],
  currentFiles: Record<string, string>,
): PlannedReplacement[] {
  const items = new Map(result.items.map((item) => [item.id, item]));
  const changesById = new Map<string, string>();
  for (const change of changes) {
    if (!items.has(change.id)) throw new Error(`Unknown copy item: ${change.id}`);
    if (changesById.has(change.id)) throw new Error(`Duplicate change for copy item: ${change.id}`);
    changesById.set(change.id, change.text);
  }

  const replacements: PlannedReplacement[] = [];
  const parsedByFile = new Map<string, ts.SourceFile>();
  for (const [id, text] of changesById) {
    const item = items.get(id)!;
    if (text === item.text) continue;
    const current = currentFiles[item.filePath];
    const snapshot = result.files[item.filePath];
    if (current === undefined || snapshot === undefined || current !== snapshot) {
      throw new Error(`Source changed since copy was extracted: ${item.filePath}`);
    }

    let source = parsedByFile.get(item.filePath);
    if (!source) {
      const parsedSource = createParsedSource(item.filePath, current);
      if (parsedSource.parseDiagnostics.length) throw new Error(`Source is malformed and cannot be edited safely: ${item.filePath}`);
      source = parsedSource;
      parsedByFile.set(item.filePath, source);
    }
    const node = findJsxTextAt(source, item.start, item.end);
    if (!node || current.slice(item.start, item.end) !== item.original) {
      throw new Error(`Copy source location is no longer valid: ${item.filePath}:${item.start}`);
    }

    replacements.push({
      filePath: item.filePath,
      start: item.start,
      end: item.end,
      text: preserveOuterJsxLayout(item.original, encodeJsxText(text)),
    });
  }

  return replacements.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.start - b.start);
}

function getComponents(source: ts.SourceFile): ComponentCandidate[] {
  const candidates: ComponentCandidate[] = [];
  const exported = new Set<string>();
  let defaultExportName: string | undefined;

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.DefaultKeyword) && !statement.name) {
      const roots = collectReturnedJsx(statement);
      if (roots.length) candidates.push({ name: "default", roots, exported: true, defaultExport: true });
    }
    if (ts.isExportAssignment(statement) && !ts.isIdentifier(statement.expression)) {
      const roots = collectExpressionJsx(statement.expression);
      if (roots.length) candidates.push({ name: "default", roots, exported: true, defaultExport: true });
    }
    if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
      defaultExportName = statement.expression.text;
    }
    if (ts.isFunctionDeclaration(statement) && statement.name && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      exported.add(statement.name.text);
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) defaultExportName = statement.name.text;
    }
    if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exported.add(declaration.name.text);
      }
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const specifier of statement.exportClause.elements) {
        if (specifier.isTypeOnly) continue;
        exported.add(specifier.name.text);
      }
    }
  }

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const roots = collectReturnedJsx(statement);
      if (roots.length) candidates.push({ name: statement.name.text, roots, exported: exported.has(statement.name.text), defaultExport: defaultExportName === statement.name.text });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const roots = collectExpressionJsx(declaration.initializer);
        if (roots.length) candidates.push({ name: declaration.name.text, roots, exported: exported.has(declaration.name.text), defaultExport: defaultExportName === declaration.name.text });
      }
    }
  }
  return candidates;
}

function chooseComponent(candidates: ComponentCandidate[], requestedName?: string, requireExport = false): ComponentCandidate | undefined {
  if (requestedName === "default") {
    return candidates.find((candidate) => candidate.defaultExport);
  }
  if (requestedName) return candidates.find((candidate) => candidate.name === requestedName && (!requireExport || candidate.exported));
  if (requireExport) return candidates.find((candidate) => candidate.defaultExport && candidate.exported)
    ?? (candidates.filter((candidate) => candidate.exported).length === 1 ? candidates.find((candidate) => candidate.exported) : undefined);
  const defaultComponent = candidates.find((candidate) => candidate.defaultExport);
  if (defaultComponent) return defaultComponent;
  const exportedComponents = candidates.filter((candidate) => candidate.exported);
  if (exportedComponents.length === 1) return exportedComponents[0];
  return candidates.length === 1 ? candidates[0] : undefined;
}

function collectReturnedJsx(fn: ts.Node): JsxRoot[] {
  const body = ts.isFunctionDeclaration(fn) || ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) ? fn.body : fn;
  if (!body || !ts.isBlock(body)) return [];
  const directReturns = body.statements.filter(ts.isReturnStatement);
  if (directReturns.length !== 1 || !directReturns[0].expression) return [];
  let nestedReturn = false;
  const visit = (node: ts.Node): void => {
    if (node !== body && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
    if (ts.isReturnStatement(node) && node !== directReturns[0]) nestedReturn = true;
    ts.forEachChild(node, visit);
  };
  for (const statement of body.statements) {
    if (statement !== directReturns[0]) visit(statement);
  }
  return nestedReturn ? [] : collectExpressionJsx(directReturns[0].expression);
}

function collectExpressionJsx(expression: ts.Expression): JsxRoot[] {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isSatisfiesExpression(current)) {
    current = current.expression;
  }
  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
    if (ts.isBlock(current.body)) return collectReturnedJsx(current.body);
    return collectExpressionJsx(current.body);
  }
  if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) || ts.isJsxFragment(current)) return [current];
  return [];
}

async function walkJsx(
  root: JsxRoot,
  onElement: (element: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => Promise<void>,
  onText: (node: ts.JsxText) => void,
): Promise<void> {
  const visit = async (node: JsxRoot | ts.JsxChild): Promise<void> => {
    if (ts.isJsxText(node)) {
      onText(node);
      return;
    }
    if (ts.isJsxExpression(node)) return;
    if (ts.isJsxElement(node)) {
      await onElement(node.openingElement);
      for (const child of node.children) await visit(child);
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      await onElement(node);
      return;
    }
    if (ts.isJsxFragment(node)) {
      for (const child of node.children) await visit(child);
    }
  };
  await visit(root);
}

async function getImportTargets(
  source: ts.SourceFile,
  importer: string,
  readFile: CopyFileReader,
): Promise<Map<string, { filePath: string; importedName: string }>> {
  const targets = new Map<string, { filePath: string; importedName: string }>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const filePath = await resolveModule(importer, statement.moduleSpecifier.text, readFile);
    if (!filePath) continue;
    if (clause.name) targets.set(clause.name.text, { filePath, importedName: "default" });
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (!element.isTypeOnly) targets.set(element.name.text, { filePath, importedName: element.propertyName?.text ?? element.name.text });
      }
    }
  }
  return targets;
}

async function resolveModule(importer: string, moduleName: string, readFile: CopyFileReader): Promise<string | undefined> {
  if (!moduleName.startsWith(".") && !moduleName.startsWith("/")) return undefined;
  const base = normalizePath(joinPath(dirname(importer), moduleName));
  const suffix = /\.(tsx|jsx)$/i.test(base);
  const candidates = suffix ? [base] : [`${base}.tsx`, `${base}.jsx`, `${base}/index.tsx`, `${base}/index.jsx`];
  const found: string[] = [];
  for (const candidate of candidates) {
    const text = await readFile(candidate);
    if (text !== undefined) found.push(candidate);
  }
  return found.length === 1 ? normalizePath(found[0]) : undefined;
}

function findJsxTextAt(source: ts.SourceFile, start: number, end: number): ts.JsxText | undefined {
  let found: ts.JsxText | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && node.getStart(source) === start && node.getEnd() === end) found = node;
    if (!found) ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function createParsedSource(filePath: string, text: string): ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] } {
  // TypeScript exposes parseDiagnostics at runtime, but some pinned compiler typings omit it.
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind(filePath)) as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] };
}

function decodeJsxEntities(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[A-Za-z][A-Za-z\d]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1] === "x" || entity[1] === "X";
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      try { return Number.isFinite(number) ? String.fromCodePoint(number) : match; } catch { return match; }
    }
    const named = NAMED_ENTITIES;
    return named[entity] ?? match;
  });
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  copy: "©", reg: "®", trade: "™", euro: "€", cent: "¢", pound: "£", yen: "¥",
  ndash: "–", mdash: "—", hellip: "…", bull: "•", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

function hasUnsupportedNamedEntity(value: string): boolean {
  const pattern = /&([a-z][\da-z]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (!Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, match[1])) return true;
  }
  return false;
}

function normalizeJsxWhitespace(value: string): string {
  const lines = value.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].replace(/\t/g, " ").trim()) {
      lastNonEmptyLine = index;
      break;
    }
  }
  let normalized = "";
  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index].replace(/\t/g, " ");
    if (index > 0) line = line.replace(/^\s+/, "");
    if (index < lines.length - 1) line = line.replace(/\s+$/, "");
    if (!line) continue;
    if (index < lastNonEmptyLine) line += " ";
    normalized += line;
  }
  return normalized;
}

function preserveOuterJsxLayout(original: string, value: string): string {
  const prefix = original.match(/^(?:[ \t]*\r?\n)+[ \t]*/)?.[0] ?? "";
  const suffix = original.match(/[ \t]*(?:\r?\n[ \t]*)+$/)?.[0] ?? "";
  return prefix + value + suffix;
}

function encodeJsxText(value: string): string {
  return value.replace(/\r\n|[\r\n&<>\u007b\u007d]/g, (char) => {
    // User-entered line breaks are copy, unlike surrounding JSX layout.
    if (char === '\r\n' || char === '\r' || char === '\n') return '&#10;';
    const entity: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "{": "&#123;", "}": "&#125;" };
    return entity[char];
  });
}

function getTagName(name: ts.JsxTagNameExpression): string | undefined {
  return ts.isIdentifier(name) ? name.text : undefined;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return !!ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((modifier) => modifier.kind === kind);
}

function scriptKind(filePath: string): ts.ScriptKind {
  return filePath.toLowerCase().endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TSX;
}

function normalizePath(filePath: string): string {
  const windows = /^[a-z]:[\\/]/i.test(filePath);
  const slash = filePath.replace(/\\/g, "/");
  const prefix = slash.startsWith("/") ? "/" : windows ? slash.slice(0, 2) + "/" : "";
  const rest = windows ? slash.slice(3) : slash.replace(/^\/+/, "");
  const parts: string[] = [];
  for (const part of rest.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." && parts.length && parts[parts.length - 1] !== "..") parts.pop();
    else if (part !== ".." || !prefix) parts.push(part);
  }
  return prefix + parts.join("/");
}

function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "." : normalized.slice(0, index) || "/";
}

function joinPath(left: string, right: string): string {
  return normalizePath(`${left}/${right}`);
}

type ComponentCandidate = {
  name: string;
  roots: JsxRoot[];
  exported: boolean;
  defaultExport: boolean;
};

type JsxRoot = ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment;
