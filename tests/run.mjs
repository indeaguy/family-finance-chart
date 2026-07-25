/**
 * Test runner: unit tests first (no Chrome), then UI regression (Chrome).
 * Exit non-zero if any suite fails.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const suites = [
    { name: 'field-model', file: 'field-model.mjs' },
    { name: 'loose-leaf-alignment', file: 'loose-leaf-alignment.mjs' },
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
console.log('\nAll test suites passed.');
