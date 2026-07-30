/**
 * Unit tests for field-model helpers, LOAN_FIELDS surfaces, JSON serialize/hydrate,
 * and FinanceCalculator.remainingBalanceAsOf.
 *
 * Run: npm run test:unit  (or npm test)
 * No Chrome required.
 */
import { loadBrowserScripts } from './helpers/load-browser-scripts.mjs';

const {
    filterFields,
    formatFieldValue,
    getFieldDisplayValue,
    serializeEntity,
    hydrateEntity,
    renderFormFields,
    LOAN_FIELDS,
    FinanceCalculator,
} = loadBrowserScripts(
    ['js/field-model.js', 'js/calculator.js', 'js/data-manager.js'],
    [
        'filterFields',
        'formatFieldValue',
        'getFieldDisplayValue',
        'serializeEntity',
        'hydrateEntity',
        'renderFormFields',
        'LOAN_FIELDS',
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

// --- field-model helpers ---

assert(typeof filterFields === 'function', 'filterFields loaded');
assert(Array.isArray(LOAN_FIELDS) && LOAN_FIELDS.length > 0, 'LOAN_FIELDS loaded');

{
    const formatted = formatFieldValue({ type: 'currency' }, 1234.5);
    assert(typeof formatted === 'string' && formatted.startsWith('$') && formatted.includes('1'),
        `formatFieldValue currency (got ${formatted})`);
}
assertEqual(formatFieldValue({ type: 'percent' }, 4.5), '4.5%', 'formatFieldValue percent');
assertEqual(formatFieldValue({ type: 'currency' }, null), '—', 'formatFieldValue empty');

// --- LOAN_FIELDS surfaces / order ---

assertEqual(
    filterFields(LOAN_FIELDS, 'table').map((f) => f.key),
    ['name', 'amount', 'rate', 'term', 'monthlyPayment', 'startDate', 'remainingBalance'],
    'table column order (Name first, Pay before Start, Balance last)'
);

assertEqual(
    filterFields(LOAN_FIELDS, 'form').map((f) => f.key),
    ['name', 'amount', 'rate', 'term', 'startDate', 'monthlyPayment'],
    'form field order (Name first, Start before Payment)'
);

const balanceField = LOAN_FIELDS.find((f) => f.key === 'remainingBalance');
assert(balanceField?.computed === true, 'remainingBalance is computed');
assert(!balanceField.form && !balanceField.export && !balanceField.import,
    'remainingBalance must not be form/export/import');

for (const field of LOAN_FIELDS) {
    if (field.computed) {
        assert(!field.form && !field.export && !field.import,
            `computed field ${field.key} must not be form/export/import`);
    }
}

assert(
    !filterFields(LOAN_FIELDS, 'export').some((f) => f.key === 'id' || f.key === 'calculatedPayment'),
    'id and calculatedPayment stay out of export'
);

// --- serialize / hydrate ---

const sampleLoan = {
    id: 42,
    name: 'Mortgage',
    amount: 350000,
    rate: 4.8,
    term: 30,
    startMonth: 1,
    startDate: '2024-01',
    monthlyPayment: 1837,
    calculatedPayment: 1837,
    isCustomPayment: false,
};

const exported = serializeEntity(sampleLoan, LOAN_FIELDS);
assertEqual(exported.monthlyPayment, null, 'export null monthlyPayment when not custom');
assertEqual(exported.isCustomPayment, false, 'export isCustomPayment');
assert(!Object.prototype.hasOwnProperty.call(exported, 'remainingBalance'),
    'export omits remainingBalance');
assert(!Object.prototype.hasOwnProperty.call(exported, 'id'), 'export omits id');
assertEqual(
    Object.keys(exported).sort(),
    ['amount', 'isCustomPayment', 'monthlyPayment', 'name', 'rate', 'startDate', 'startMonth', 'term'].sort(),
    'export key set'
);

const customExported = serializeEntity(
    { ...sampleLoan, isCustomPayment: true, monthlyPayment: 2000 },
    LOAN_FIELDS
);
assertEqual(customExported.monthlyPayment, 2000, 'export custom monthlyPayment value');

const hydrated = hydrateEntity(
    {
        amount: 10000,
        rate: 0,
        term: 2,
        startDate: '2025-06',
        startMonth: 6,
        monthlyPayment: null,
        isCustomPayment: false,
    },
    LOAN_FIELDS
);
assertEqual(hydrated.amount, 10000, 'hydrate amount');
assertEqual(hydrated.startMonth, 6, 'hydrate startMonth');
assert(!Object.prototype.hasOwnProperty.call(hydrated, 'remainingBalance'),
    'hydrate skips computed remainingBalance');
assert(!Object.prototype.hasOwnProperty.call(hydrated, 'id'), 'hydrate skips id');

const hydratedDefaults = hydrateEntity({}, LOAN_FIELDS);
assertEqual(hydratedDefaults.amount, 200000, 'hydrate applies amount default');
assertEqual(hydratedDefaults.isCustomPayment, false, 'hydrate applies isCustomPayment default');

// --- remainingBalanceAsOf ---

const calc = new FinanceCalculator();

const futureBal = calc.remainingBalanceAsOf(
    { amount: 10000, rate: 5, monthlyPayment: 200, startDate: '2030-01' },
    new Date('2026-07-15')
);
assertEqual(futureBal, 10000, 'future-start loan balance equals amount');

const zeroRate = calc.remainingBalanceAsOf(
    { amount: 12000, rate: 0, monthlyPayment: 1000, startDate: '2025-07' },
    new Date('2026-07-15')
);
assertClose(zeroRate, 0, 'zero-rate loan paid after 13 months of $1000');

const paidOff = calc.remainingBalanceAsOf(
    { amount: 1000, rate: 0, monthlyPayment: 1000, startDate: '2020-01' },
    new Date('2026-07-15')
);
assertEqual(paidOff, 0, 'fully paid loan balance is 0');

const oneMonth = calc.remainingBalanceAsOf(
    { amount: 12000, rate: 0, monthlyPayment: 1000, startDate: '2026-07' },
    new Date('2026-07-15')
);
assertClose(oneMonth, 11000, 'one payment month reduces principal by payment when rate is 0');

const viaStartMonth = calc.remainingBalanceAsOf(
    { amount: 12000, rate: 0, monthlyPayment: 1000, startMonth: 1, startDate: '' },
    new Date(2026, 6, 15),
    new Date(2026, 6, 1)
);
assertClose(viaStartMonth, 11000, 'startMonth + baseDate when startDate empty');

// --- computed field via schema ---

const balanceViaSchema = getFieldDisplayValue(balanceField, sampleLoan, {
    calculator: calc,
    asOfDate: new Date('2024-01-15'),
    baseDate: new Date('2024-01-01'),
});
assert(
    typeof balanceViaSchema === 'string' && balanceViaSchema.startsWith('$'),
    `remainingBalance display is currency string, got ${balanceViaSchema}`
);

const afterOneMonth = calc.remainingBalanceAsOf(
    sampleLoan,
    new Date('2024-01-15'),
    new Date('2024-01-01')
);
assert(afterOneMonth < sampleLoan.amount, 'sample loan balance drops after first month');

// --- renderFormFields ---

const container = { innerHTML: '' };
renderFormFields(container, LOAN_FIELDS);
assert(container.innerHTML.includes('id="loanName"'), 'form renders loanName');
assert(container.innerHTML.includes('id="loanAmount"'), 'form renders loanAmount');
assert(container.innerHTML.includes('id="loanStartDate"'), 'form renders loanStartDate');
assert(container.innerHTML.includes('id="loanMonthlyPayment"'), 'form renders loanMonthlyPayment');
assert(!container.innerHTML.includes('remainingBalance'), 'form does not render remainingBalance');
assert(
    (container.innerHTML.match(/sheet-ruled-row input-row/g) || []).length === 6,
    'form renders six input rows'
);

// --- summary ---

if (failed) {
    console.error(`field-model tests: ${failed} failed, ${passed} passed`);
    process.exitCode = 1;
} else {
    console.log(`field-model tests OK (${passed} assertions)`);
}
