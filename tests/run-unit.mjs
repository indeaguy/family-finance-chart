/**
 * Unit test runner (no Chrome): field-model + historical-import.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const suites = [
    { name: 'field-model', file: 'field-model.mjs' },
    { name: 'historical-import', file: 'historical-import.mjs' },
];

let failed = false;

for (const suite of suites) {
    console.log(`\n== ${suite.name} ==`);
    const result = spawnSync(process.execPath, [path.join(dir, suite.file)], {
        stdio: 'inherit',
        env: process.env,
    });
    if (result.status !== 0) {
        failed = true;
        console.error(`${suite.name} exited ${result.status ?? 'with signal'}`);
    }
}

if (failed) {
    process.exit(1);
}
console.log('\nAll unit suites passed.');
