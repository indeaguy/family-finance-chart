/**
 * Unit tests for historical balance import (CSV / OFX / QIF) and
 * DataManager.mergeEntityBalanceOverrides.
 *
 * Run: npm run test:unit  (or npm test)
 * No Chrome required.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadBrowserScripts, ROOT } from './helpers/load-browser-scripts.mjs';

const {
    parseHistoricalBalanceFile,
    aggregateBalancesByMonth,
    detectHistoricalBalanceFormat,
    HistoricalImportError,
    DataManager,
    FinanceCalculator,
} = loadBrowserScripts(
    [
        'js/field-model.js',
        'js/calculator.js',
        'js/default_config/example-default-loans.js',
        'js/data-manager.js',
        'js/historical-import.js',
    ],
    [
        'parseHistoricalBalanceFile',
        'aggregateBalancesByMonth',
        'detectHistoricalBalanceFormat',
        'HistoricalImportError',
        'DataManager',
        'FinanceCalculator',
    ]
);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (cond) {
        passed += 1;
    } else {
        failed += 1;
        console.error(`FAIL: ${msg}`);
    }
}

function assertEqual(actual, expected, msg) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    assert(ok, `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function assertClose(actual, expected, msg, eps = 0.01) {
    assert(Math.abs(actual - expected) <= eps, `${msg} (expected ~${expected}, got ${actual})`);
}

function readExample(...parts) {
    return fs.readFileSync(path.join(ROOT, 'examples/historical-imports', ...parts), 'utf8');
}

assert(typeof parseHistoricalBalanceFile === 'function', 'parseHistoricalBalanceFile loaded');
assert(typeof aggregateBalancesByMonth === 'function', 'aggregateBalancesByMonth loaded');
assert(typeof HistoricalImportError === 'function', 'HistoricalImportError loaded');

// --- aggregation: last date in month wins; same-day last in order ---
{
    const monthly = aggregateBalancesByMonth([
        { date: new Date(2024, 0, 5), balance: 100 },
        { date: new Date(2024, 0, 28), balance: 200 },
        { date: new Date(2024, 0, 28), balance: 250 },
        { date: new Date(2024, 1, 1), balance: 300 },
    ]);
    assertEqual(monthly, { '2024-01': 250, '2024-02': 300 }, 'last date (and same-day last) wins');
}

{
    const monthly = aggregateBalancesByMonth([
        { date: new Date(2024, 2, 10), balance: -1500 },
    ]);
    assertEqual(monthly, { '2024-03': 1500 }, 'balances stored as absolute value');
}

// --- format detection ---
assertEqual(detectHistoricalBalanceFormat('x.ofx', 'Date,Balance\n'), 'ofx', 'extension ofx');
assertEqual(detectHistoricalBalanceFormat('x.qfx', ''), 'ofx', 'extension qfx');
assertEqual(detectHistoricalBalanceFormat('x.qif', ''), 'qif', 'extension qif');
assertEqual(detectHistoricalBalanceFormat('x.csv', 'OFXHEADER:100\n'), 'ofx', 'content sniff ofx');
assertEqual(detectHistoricalBalanceFormat('x.csv', '!Type:Bank\n'), 'qif', 'content sniff qif');
assertEqual(detectHistoricalBalanceFormat('x.csv', 'Date,Balance\n'), 'csv', 'csv default');

// --- CSV headered ---
{
    const text = `Date,Balance
2024-01-05,"$12,400.00"
2024-01-28,"$12,850.50"
2024-02-29,"$13,475.25"
`;
    const result = parseHistoricalBalanceFile('balances.csv', text);
    assertEqual(result.format, 'csv', 'csv format');
    assertClose(result.monthly['2024-01'], 12850.5, 'csv jan last day');
    assertClose(result.monthly['2024-02'], 13475.25, 'csv feb');
}

// --- CSV headerless ---
{
    const text = `2024-03-01,1000
2024-03-15,1100
04/30/2024,1200
`;
    const result = parseHistoricalBalanceFile('plain.csv', text);
    assertClose(result.monthly['2024-03'], 1100, 'headerless march');
    assertClose(result.monthly['2024-04'], 1200, 'headerless april MDY');
    assert(result.warnings.length > 0, 'headerless warns about missing headers');
}

// --- CSV As Of / Ending Balance aliases ---
{
    const text = `As Of,Ending Balance
2024-06-15,22070
2024-06-30,21810.9
`;
    const result = parseHistoricalBalanceFile('loan.csv', text);
    assertClose(result.monthly['2024-06'], 21810.9, 'alias columns');
}

// --- CSV empty / no balance ---
{
    let threw = false;
    try {
        parseHistoricalBalanceFile('bad.csv', 'Description,Amount\nCoffee,5\n');
    } catch (e) {
        threw = e instanceof HistoricalImportError || e.name === 'HistoricalImportError';
    }
    assert(threw, 'CSV without date+balance throws HistoricalImportError');
}

// --- example savings CSV (2020–2025) ---
{
    const result = parseHistoricalBalanceFile('savings-balances.csv', readExample('csv', 'savings-balances.csv'));
    assertEqual(Object.keys(result.monthly).length, 72, 'example savings has 72 months');
    assert(result.monthly['2020-01'] != null, 'example savings starts 2020-01');
    assert(result.monthly['2025-12'] != null, 'example savings ends 2025-12');
    assert(result.monthly['2025-12'] > result.monthly['2020-01'], 'example savings grows');
}

// --- example loan CSV ---
{
    const result = parseHistoricalBalanceFile('loan-balances.csv', readExample('csv', 'loan-balances.csv'));
    assert(result.monthly['2020-01'] != null, 'example loan starts 2020-01');
    assert(result.monthly['2025-12'] != null, 'example loan ends 2025-12');
    assert(result.monthly['2025-12'] < result.monthly['2020-01'], 'example loan declines');
}

// --- OFX ---
{
    const ofx = `<OFX>
<STMTRS>
<LEDGERBAL>
<BALAMT>1000.00
<DTASOF>20240115
</LEDGERBAL>
<BAL>
<BALAMT>1100.50
<DTASOF>20240131
</BAL>
<AVAILBAL>
<BALAMT>1200
<DTASOF>20240229
</AVAILBAL>
</STMTRS>
</OFX>`;
    const result = parseHistoricalBalanceFile('snap.ofx', ofx);
    assertEqual(result.format, 'ofx', 'ofx format');
    assertClose(result.monthly['2024-01'], 1100.5, 'ofx last jan snapshot');
    assertClose(result.monthly['2024-02'], 1200, 'ofx feb');
}

{
    const result = parseHistoricalBalanceFile('savings-ledger.ofx', readExample('ofx', 'savings-ledger.ofx'));
    assert(result.monthly['2020-01'] != null, 'example ofx savings starts 2020');
    assert(Object.keys(result.monthly).length >= 20, 'example ofx savings has many snapshots');
}

{
    const result = parseHistoricalBalanceFile('loan-ledger.ofx', readExample('ofx', 'loan-ledger.ofx'));
    assert(result.monthly['2020-01'] != null, 'example ofx loan starts 2020');
    assert(result.monthly['2025-12'] < result.monthly['2020-01'], 'example ofx loan declines');
}

// --- QIF running balance ---
{
    const qif = `!Type:Bank
D1/1/2024
T10000.00
POpening Balance
^
D1/15/2024
T500.00
PPayroll
^
D1/28/2024
T-100.00
PSpend
^
D2/10/2024
T200.00
PBonus
^
`;
    const result = parseHistoricalBalanceFile('run.qif', qif);
    assertEqual(result.format, 'qif', 'qif format');
    // 10000 + 500 - 100 = 10400 end of Jan; +200 = 10600 in Feb
    assertClose(result.monthly['2024-01'], 10400, 'qif jan running');
    assertClose(result.monthly['2024-02'], 10600, 'qif feb running');
}

{
    const result = parseHistoricalBalanceFile('savings-running.qif', readExample('qif', 'savings-running.qif'));
    assert(result.monthly['2020-01'] != null, 'example qif savings starts 2020');
    assert(Object.keys(result.monthly).length >= 60, 'example qif savings spans years');
}

{
    const result = parseHistoricalBalanceFile('loan-running.qif', readExample('qif', 'loan-running.qif'));
    assert(result.monthly['2020-01'] != null, 'example qif loan starts 2020');
    assert(result.monthly['2025-12'] < result.monthly['2020-01'], 'example qif loan declines');
}

// --- mergeEntityBalanceOverrides ---
{
    const dm = new DataManager();
    dm.setCalculator(new FinanceCalculator());
    // Bypass createLoan confirm() path — seed entity directly.
    dm.loans.push({
        id: 42,
        name: 'Test',
        amount: 10000,
        rate: 5,
        term: 60,
        startDate: '2024-01',
        startMonth: 1,
        monthlyPayment: 200,
        calculatedPayment: 200,
        isCustomPayment: true,
        balanceOverrides: { '2024-01': 9000, '2023-12': 9500 }
    });
    dm.mergeEntityBalanceOverrides('loan', 42, {
        '2024-01': 8800,
        '2024-02': 8600
    });
    const overrides = dm.getEntityBalanceOverrides('loan', 42);
    assertClose(overrides['2023-12'], 9500, 'merge keeps untouched months');
    assertClose(overrides['2024-01'], 8800, 'merge overwrites imported months');
    assertClose(overrides['2024-02'], 8600, 'merge adds new months');
}

// --- ensureChartCoversMonths rewinds startDate / extends timePeriod ---
{
    const dom = {
        startDate: { value: '2024-01' },
        timePeriod: { value: '20' },
    };
    const {
        parseHistoricalBalanceFile: parseInVm,
        DataManager: DM,
        FinanceCalculator: FC,
    } = loadBrowserScripts(
        [
            'js/field-model.js',
            'js/calculator.js',
            'js/default_config/example-default-loans.js',
            'js/data-manager.js',
            'js/historical-import.js',
        ],
        ['parseHistoricalBalanceFile', 'DataManager', 'FinanceCalculator'],
        {
            document: {
                getElementById: (id) => dom[id] || null,
            },
        }
    );
    void parseInVm;
    const dm = new DM();
    dm.setCalculator(new FC());
    dm.loans.push({
        id: 7,
        name: 'Car',
        amount: 20000,
        rate: 4,
        term: 60,
        startDate: '2024-01',
        startMonth: 1,
        monthlyPayment: 400,
        calculatedPayment: 400,
        isCustomPayment: true,
        balanceOverrides: {}
    });
    dm.savingsAccounts.push({
        id: 8,
        name: 'Emergency',
        amount: 5000,
        monthlyContribution: 100,
        rate: 4,
        startDate: '2024-06',
        startMonth: 6,
        endDate: null,
        endMonth: null,
        includeInTotal: true,
        balanceOverrides: {}
    });
    dm.overrides = { 12: { savings: 1, loanBalance: 2 } };

    const cover = dm.ensureChartCoversMonths('loan', 7, {
        '2020-01': 18000,
        '2020-06': 17000,
        '2021-01': 16000
    });
    assert(cover.rewound, 'chart rewound for early history');
    assertEqual(dom.startDate.value, '2020-01', 'startDate rewound to 2020-01');
    assertEqual(cover.monthsAdded, 48, '48 months added before prior start');
    assert(parseInt(dom.timePeriod.value, 10) >= 24, 'timePeriod extended to keep prior end');
    assertEqual(dm.loans[0].startMonth, 1, 'imported loan aligned to chart start');
    assertEqual(dm.loans[0].startDate, '2020-01', 'imported loan startDate earliest month');
    // Savings that started 2024-06 under old base (month 6) → absolute 2024-06 → month 54 on new base
    assertEqual(dm.savingsAccounts[0].startDate, '2024-06', 'other entity keeps absolute start');
    assertEqual(dm.savingsAccounts[0].startMonth, 54, 'other entity startMonth reindexed');
    assertEqual(dm.overrides[60].loanBalance, 2, 'global override month index shifted by 48');
}

console.log(`\nhistorical-import: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
