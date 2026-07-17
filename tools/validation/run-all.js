const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const validationRoot = __dirname;
const projectRoot = path.resolve(validationRoot, '..', '..');
const validators = fs.readdirSync(validationRoot)
    .filter(name => /^validate-.+\.js$/.test(name))
    .sort();

let failed = 0;
for (const validator of validators) {
    console.log(`\n[validation] ${validator}`);
    const result = spawnSync(process.execPath, [path.join(validationRoot, validator)], {
        cwd: projectRoot,
        stdio: 'inherit'
    });
    if (result.status !== 0) failed += 1;
}

if (failed) {
    console.error(`\nValidation suite failed: ${failed}/${validators.length} scripts.`);
    process.exit(1);
}

console.log(`\nValidation suite passed: ${validators.length}/${validators.length} scripts.`);
