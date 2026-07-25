/**
 * Regression: every .sheet-ruled-row on the Loans loose-leaf must sit on the
 * paper's --leaf-line grid. <table> rows ignore max-height and drift — keep
 * loans as div .sheet-ruled-row children (see css/folder.css + ui-manager.js).
 *
 * Run: npm test
 * Requires Google Chrome (or CHROME_PATH).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CHROME =
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TOLERANCE_PX = 0.5;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

function startStaticServer() {
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = urlPath === '/' ? '/index.html' : urlPath;
        const filePath = path.normalize(path.join(ROOT, rel));
        if (!filePath.startsWith(ROOT)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
            res.end(data);
        });
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
        });
    });
}

const SAMPLE_LOANS = [
    { id: 1, amount: 350000, rate: 4.8, term: 30, startMonth: 1, startDate: '2024-01', monthlyPayment: 1837, calculatedPayment: 1837, isCustomPayment: false },
    { id: 2, amount: 45000, rate: 6.2, term: 5, startMonth: 6, startDate: '2024-06', monthlyPayment: 1000, calculatedPayment: 875, isCustomPayment: true },
    { id: 3, amount: 15000, rate: 12.5, term: 3, startMonth: 12, startDate: '2024-12', monthlyPayment: 502, calculatedPayment: 502, isCustomPayment: false },
    { id: 4, amount: 8000, rate: 9.9, term: 2, startMonth: 3, startDate: '2024-03', monthlyPayment: 366, calculatedPayment: 366, isCustomPayment: false },
    { id: 5, amount: 22000, rate: 5.5, term: 4, startMonth: 8, startDate: '2024-08', monthlyPayment: 512, calculatedPayment: 512, isCustomPayment: false },
];

async function main() {
    if (!fs.existsSync(CHROME)) {
        console.error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`);
        process.exit(1);
    }

    const { server, baseUrl } = await startStaticServer();
    const browser = await chromium.launch({ executablePath: CHROME, headless: true });

    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);

        await page.evaluate((loans) => {
            if (typeof openDrawer === 'function') openDrawer();
            window.app.uiManager.updateLoansList(loans);
        }, SAMPLE_LOANS);

        // Let layout settle after drawer open + list paint
        await page.waitForTimeout(200);

        const result = await page.evaluate(() => {
            const sheet = document.getElementById('folderSheetLoans');
            if (!sheet) return { error: 'missing #folderSheetLoans' };

            const leafLine = parseFloat(getComputedStyle(sheet).getPropertyValue('--leaf-line'));
            const sheetTop = sheet.getBoundingClientRect().top;
            const rows = [...sheet.querySelectorAll('.sheet-ruled-row')];
            const tableTags = [...sheet.querySelectorAll('.loans-table')].map((el) => el.tagName);

            return {
                leafLine,
                rowCount: rows.length,
                tableTags,
                rows: rows.map((row, i) => {
                    const top = row.getBoundingClientRect().top - sheetTop;
                    return {
                        i,
                        tag: row.tagName,
                        top,
                        expectedTop: i * leafLine,
                        drift: top - i * leafLine,
                    };
                }),
            };
        });

        if (result.error) throw new Error(result.error);

        const failures = [];

        if (!(result.leafLine > 0)) {
            failures.push(`--leaf-line must be a positive px value, got ${result.leafLine}`);
        }
        if (result.rowCount < 3) {
            failures.push(`expected heading + header + loans (>=3 rows), got ${result.rowCount}`);
        }
        if (result.tableTags.some((t) => t === 'TABLE')) {
            failures.push('loans list must not use <table> (row height drifts off ruled lines)');
        }
        for (const row of result.rows) {
            if (row.tag === 'TR') {
                failures.push(`row ${row.i} is a <tr>; use div.sheet-ruled-row`);
            }
            if (Math.abs(row.drift) > TOLERANCE_PX) {
                failures.push(
                    `row ${row.i} top=${row.top.toFixed(2)} drift=${row.drift.toFixed(2)}px ` +
                        `(expected ${row.expectedTop}, --leaf-line=${result.leafLine})`
                );
            }
        }
        for (let i = 1; i < result.rows.length; i++) {
            const step = result.rows[i].top - result.rows[i - 1].top;
            if (Math.abs(step - result.leafLine) > TOLERANCE_PX) {
                failures.push(
                    `gap between row ${i - 1} and ${i} is ${step.toFixed(2)}px, want ${result.leafLine}`
                );
            }
        }

        if (failures.length) {
            console.error('loose-leaf alignment FAILED:');
            for (const f of failures) console.error(`  - ${f}`);
            console.error(JSON.stringify(result, null, 2));
            process.exitCode = 1;
        } else {
            console.log(
                `loose-leaf alignment OK (${result.rowCount} rows, --leaf-line=${result.leafLine}px, max|drift|<${TOLERANCE_PX}px)`
            );
        }
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
