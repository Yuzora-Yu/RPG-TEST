/* eslint-disable no-console */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const archiveRoot = path.join(root, 'archive', 'assets-legacy-20260723', 'runtime-version-suffixes');
const assetsSource = fs.readFileSync(path.join(root, 'assets.js'), 'utf8');
const assetPathPattern = /assets\/[A-Za-z0-9_./ ()#\-\u3000\u3040-\u30ff\u3400-\u9fff]+?\.(?:png|gif|jpe?g|webp|svg)/gi;
const versionPattern = /(?:[-_]v\d{3,})((?:[-_][a-z0-9]+)*)(?=\.[^.]+$)/i;

const runtimePaths = [...new Set([...assetsSource.matchAll(assetPathPattern)].map(match => match[0]))];
const mappings = runtimePaths
  .filter(relative => versionPattern.test(relative))
  .map(relative => {
    const next = relative.replace(versionPattern, (_full, suffix) => {
      const tokens = String(suffix || '').split(/[-_]/).filter(Boolean);
      return tokens.length ? `_variant_${tokens.join('_')}` : '';
    });
    return { from: relative, to: next };
  });

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function ensureInside(base, candidate, label) {
  const resolvedBase = path.resolve(base) + path.sep;
  const resolved = path.resolve(candidate);
  if (!(`${resolved}${path.sep}`).startsWith(resolvedBase) && !resolved.startsWith(resolvedBase)) {
    throw new Error(`${label} escapes ${base}: ${candidate}`);
  }
}

function uniqueArchivePath(relative, tag) {
  const parsed = path.parse(relative);
  let candidate = path.join(archiveRoot, parsed.dir, `${parsed.name}${tag}${parsed.ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(archiveRoot, parsed.dir, `${parsed.name}${tag}-${index}${parsed.ext}`);
    index++;
  }
  return candidate;
}

function archive(file, relative, tag) {
  const target = uniqueArchivePath(relative, tag);
  ensureInside(archiveRoot, target, 'archive target');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(file, target);
  return target;
}

const textExtensions = new Set(['.js', '.html', '.css', '.md', '.json', '.py', '.txt', '.csv']);
const textFiles = [];
function collectTextFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'archive') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectTextFiles(absolute);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) textFiles.push(absolute);
  }
}
collectTextFiles(root);

let updatedTextFiles = 0;
for (const file of textFiles) {
  let source = fs.readFileSync(file, 'utf8');
  const before = source;
  for (const mapping of mappings) source = source.split(mapping.from).join(mapping.to);
  if (source !== before) {
    fs.writeFileSync(file, source, 'utf8');
    updatedTextFiles++;
  }
}

let renamed = 0;
let archivedDuplicates = 0;
let archivedConflicts = 0;
for (const mapping of mappings) {
  const from = path.join(root, mapping.from);
  const to = path.join(root, mapping.to);
  ensureInside(path.join(root, 'assets'), from, 'source asset');
  ensureInside(path.join(root, 'assets'), to, 'target asset');
  if (!fs.existsSync(from)) {
    if (!fs.existsSync(to)) throw new Error(`Neither source nor fixed-name asset exists: ${mapping.from}`);
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) {
    if (hash(from) === hash(to)) {
      archive(from, mapping.from, '-duplicate');
      archivedDuplicates++;
      continue;
    }
    archive(to, mapping.to, '-superseded');
    archivedConflicts++;
  }
  fs.renameSync(from, to);
  renamed++;
}

console.log(`Runtime asset migration complete: ${mappings.length} paths, ${renamed} renamed, ${archivedDuplicates} duplicate sources archived, ${archivedConflicts} conflicting targets archived, ${updatedTextFiles} text files updated.`);
