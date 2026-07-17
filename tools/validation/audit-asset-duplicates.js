const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const assetRoot = path.join(root, 'assets');
const outputDir = path.join(root, 'logs', 'asset-audit');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const textExtensions = new Set(['.js', '.css', '.html', '.json']);
const ignoredDirectories = new Set(['.git', 'node_modules', 'vendor', 'logs', 'work']);

const toRelative = absolute => path.relative(root, absolute).replace(/\\/g, '/');

function walk(directory, predicate, output = []) {
    if (!fs.existsSync(directory)) return output;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute, predicate, output);
        else if (predicate(absolute)) output.push(absolute);
    }
    return output;
}

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function collectRegisteredAssetPaths() {
    const source = fs.readFileSync(path.join(root, 'assets.js'), 'utf8');
    const context = { console, window: {} };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${source}\nglobalThis.__PRISMA_ASSETS__ = PRISMA_ASSETS;`, context, { filename: 'assets.js' });
    const assets = context.__PRISMA_ASSETS__ || {};
    const paths = new Set();
    const collect = value => {
        if (typeof value === 'string' && value.startsWith('assets/')) paths.add(value.replace(/\\/g, '/'));
        else if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(assets);
    return paths;
}

const registered = collectRegisteredAssetPaths();
const textFiles = walk(root, file => textExtensions.has(path.extname(file).toLowerCase()));
const textSources = textFiles.map(file => ({ file: toRelative(file), source: fs.readFileSync(file, 'utf8').replace(/\\/g, '/') }));
const imageFiles = walk(assetRoot, file => imageExtensions.has(path.extname(file).toLowerCase()));
const hashGroups = new Map();

for (const file of imageFiles) {
    const hash = sha256(file);
    if (!hashGroups.has(hash)) hashGroups.set(hash, []);
    hashGroups.get(hash).push(file);
}

const duplicateGroups = [...hashGroups.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => {
        const entries = files.map(file => {
            const relative = toRelative(file);
            const directReferences = textSources
                .filter(record => record.source.includes(relative))
                .map(record => record.file);
            const registryReference = registered.has(relative);
            return {
                path: relative,
                bytes: fs.statSync(file).size,
                registryReference,
                directReferences,
                activeReference: registryReference || directReferences.length > 0,
            };
        });
        const activeCount = entries.filter(entry => entry.activeReference).length;
        const classification = activeCount === entries.length
            ? 'keep-all-active'
            : activeCount > 0
                ? 'review-unreferenced-duplicates'
                : 'review-orphan-duplicate-group';
        return { hash, classification, files: entries };
    })
    .sort((a, b) => b.files[0].bytes * b.files.length - a.files[0].bytes * a.files.length);

const missingRegistered = [...registered]
    .filter(relative => !fs.existsSync(path.join(root, relative)))
    .sort();
const report = {
    generatedAt: new Date().toISOString(),
    policy: 'Read-only audit. No duplicate is safe to delete without manual reference and compatibility review.',
    totals: {
        imageFiles: imageFiles.length,
        registeredPaths: registered.size,
        duplicateGroups: duplicateGroups.length,
        duplicateFiles: duplicateGroups.reduce((sum, group) => sum + group.files.length, 0),
        missingRegisteredPaths: missingRegistered.length,
    },
    missingRegistered,
    duplicateGroups,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'asset-duplicate-report.json'), `${JSON.stringify(report, null, 2)}\n`);

const counts = Object.fromEntries([
    'keep-all-active',
    'review-unreferenced-duplicates',
    'review-orphan-duplicate-group',
].map(key => [key, duplicateGroups.filter(group => group.classification === key).length]));
const markdown = [
    '# アセット重複・参照監査',
    '',
    `生成日時: ${report.generatedAt}`,
    '',
    'この監査は読み取り専用であり、画像を削除しない。完全一致画像であっても、互換キー、原本、ランタイム、キャッシュ用途を確認するまで削除候補と断定しない。',
    '',
    '## 集計',
    '',
    `- 画像ファイル: ${report.totals.imageFiles}`,
    `- 中央登録パス: ${report.totals.registeredPaths}`,
    `- 完全一致重複グループ: ${report.totals.duplicateGroups}`,
    `- 登録済みだが実体なし: ${report.totals.missingRegisteredPaths}`,
    `- 全ファイルに現行参照あり: ${counts['keep-all-active']}`,
    `- 参照あり・なしが混在（要手動確認）: ${counts['review-unreferenced-duplicates']}`,
    `- 直接参照を検出できない重複群（要手動確認）: ${counts['review-orphan-duplicate-group']}`,
    '',
    '## 優先確認グループ（最大30件）',
    '',
    ...duplicateGroups.slice(0, 30).flatMap((group, index) => [
        `### ${index + 1}. ${group.classification}`,
        '',
        ...group.files.map(file => `- \`${file.path}\` — ${file.activeReference ? '参照検出' : '参照未検出'} / ${file.bytes} bytes`),
        '',
    ]),
    '完全な参照元一覧とSHA-256は `asset-duplicate-report.json` を参照する。',
    '',
].join('\n');
fs.writeFileSync(path.join(outputDir, 'asset-duplicate-report.md'), markdown);

if (missingRegistered.length) {
    console.error(`Asset duplicate audit found ${missingRegistered.length} registered paths with no file.`);
    process.exit(1);
}
console.log(`Asset duplicate audit completed: ${imageFiles.length} images, ${duplicateGroups.length} duplicate groups, no files deleted.`);
console.log(`Reports: ${toRelative(path.join(outputDir, 'asset-duplicate-report.json'))}, ${toRelative(path.join(outputDir, 'asset-duplicate-report.md'))}`);
