/**
 * Load classic (non-module) browser scripts into a Node vm and return selected globals.
 * Used by unit tests — no DOM except a minimal document stub.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * @param {string[]} relativePaths paths from repo root, e.g. ['js/field-model.js']
 * @param {string[]} exportNames bare globals to return
 * @param {{ document?: object }} [options]
 */
export function loadBrowserScripts(relativePaths, exportNames, options = {}) {
    const sandbox = {
        console,
        document: options.document || {
            getElementById: () => null,
        },
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    const bodies = relativePaths.map((rel) => {
        const filePath = path.join(ROOT, rel);
        return fs.readFileSync(filePath, 'utf8');
    });

    const exportBlock = `({
${exportNames.map((name) => `  ${name}: typeof ${name} !== 'undefined' ? ${name} : undefined`).join(',\n')}
})`;

    const code = `${bodies.join('\n;\n')}\n;\n${exportBlock}`;
    return vm.runInNewContext(code, sandbox, { filename: 'browser-bundle.js' });
}

export { ROOT };
