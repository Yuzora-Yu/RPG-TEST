/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assetsRoot = path.join(root, 'assets');
const archiveRoot = path.join(root, 'archive', 'assets-legacy-20260723', 'unreferenced-versioned');
const apply = process.argv.includes('--apply');
const versionPattern = /(?:[-_]v\d{3,})(?:[-_][a-z0-9]+)*(?=\.[^.]+$)/i;
const imageExtensions = new Set(['.png', '.gif', '.jpg', '.jpeg', '.webp', '.svg']);
const textExtensions = new Set(['.js', '.html', '.css', '.md', '.json', '.py', '.txt', '.csv']);

function inside(base, candidate) {
  const prefix = path.resolve(base) + path.sep;
  return path.resolve(candidate).startsWith(prefix);
}

const textCorpus = [];
function collectText(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'archive' || (directory === assetsRoot && entry.name === 'managed')) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectText(absolute);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) textCorpus.push(fs.readFileSync(absolute, 'utf8'));
  }
}
collectText(root);
const allText = textCorpus.join('\n');

const candidates = [];
function collectAssets(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (directory === assetsRoot && entry.name === 'managed') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectAssets(absolute);
    else if (imageExtensions.has(path.extname(entry.name).toLowerCase()) && versionPattern.test(entry.name)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (!allText.includes(relative)) candidates.push({ absolute, relative });
    }
  }
}
collectAssets(assetsRoot);

function uniqueTarget(relative) {
  const parsed = path.parse(relative);
  let target = path.join(archiveRoot, parsed.dir, parsed.base);
  let index = 2;
  while (fs.existsSync(target)) {
    target = path.join(archiveRoot, parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    index++;
  }
  return target;
}

if (apply) {
  for (const candidate of candidates) {
    const target = uniqueTarget(candidate.relative);
    if (!inside(assetsRoot, candidate.absolute) || !inside(archiveRoot, target)) throw new Error(`Unsafe archive path: ${candidate.relative}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(candidate.absolute, target);
  }
}

console.log(`${apply ? 'Archived' : 'Dry run'}: ${candidates.length} unreferenced version-suffixed runtime assets.`);
for (const candidate of candidates.slice(0, 25)) console.log(`- ${candidate.relative}`);
if (candidates.length > 25) console.log(`- ... ${candidates.length - 25} more`);
