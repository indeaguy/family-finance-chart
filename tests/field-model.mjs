/**
 * Unit tests for field-model helpers, LOAN_FIELDS / SAVINGS_FIELDS surfaces,
 * JSON serialize/hydrate, FinanceCalculator.remainingBalanceAsOf, and
 * savingsBalanceAsOf (including end-date freeze and entity balanceOverrides).
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
    SAVINGS_FIELDS,
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
        'SAVINGS_FIELDS',
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
    ['amount', 'balanceOverrides', 'isCustomPayment', 'monthlyPayment', 'name', 'rate', 'startDate', 'startMonth', 'term'].sort(),
    'export key set'
);
assertEqual(exported.balanceOverrides, {}, 'export empty balanceOverrides by default');

const loanOverrideField = LOAN_FIELDS.find((f) => f.key === 'balanceOverrides');
assert(loanOverrideField?.export && loanOverrideField?.import, 'loan balanceOverrides is export/import');
assert(!loanOverrideField.form && !loanOverrideField.table && !loanOverrideField.detail,
    'loan balanceOverrides stays off form/table/detail');

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

const prefixed = { innerHTML: '' };
renderFormFields(prefixed, LOAN_FIELDS, { idPrefix: 'ac-loan-1-' });
assert(prefixed.innerHTML.includes('id="ac-loan-1-loanName"'), 'form idPrefix scopes loanName');
assert(prefixed.innerHTML.includes('for="ac-loan-1-loanAmount"'), 'form idPrefix scopes label for');
assert(!prefixed.innerHTML.includes('id="loanName"'), 'prefixed form does not use bare loanName id');

// --- SAVINGS_FIELDS surfaces / order ---

assert(Array.isArray(SAVINGS_FIELDS) && SAVINGS_FIELDS.length > 0, 'SAVINGS_FIELDS loaded');

assertEqual(
    filterFields(SAVINGS_FIELDS, 'table').map((f) => f.key),
    ['name', 'amount', 'monthlyContribution', 'rate', 'startDate', 'endDate', 'currentBalance'],
    'savings table column order'
);

assertEqual(
    filterFields(SAVINGS_FIELDS, 'form').map((f) => f.key),
    ['name', 'amount', 'monthlyContribution', 'rate', 'startDate', 'endDate', 'includeInTotal'],
    'savings form field order'
);

const currentBalanceField = SAVINGS_FIELDS.find((f) => f.key === 'currentBalance');
assert(currentBalanceField?.computed === true, 'currentBalance is computed');
assert(!currentBalanceField.form && !currentBalanceField.export && !currentBalanceField.import,
    'currentBalance must not be form/export/import');

for (const field of SAVINGS_FIELDS) {
    if (field.computed) {
        assert(!field.form && !field.export && !field.import,
            `computed field ${field.key} must not be form/export/import`);
    }
}

const sampleSavings = {
    id: 7,
    name: 'Emergency Fund',
    amount: 10000,
    monthlyContribution: 200,
    rate: 6,
    startMonth: 1,
    startDate: '2024-01',
    endMonth: null,
    endDate: '',
    includeInTotal: true,
};

const exportedSavings = serializeEntity(sampleSavings, SAVINGS_FIELDS);
assertEqual(exportedSavings.endDate, null, 'export null endDate when ongoing');
assertEqual(exportedSavings.endMonth, null, 'export null endMonth when ongoing');
assertEqual(exportedSavings.includeInTotal, true, 'export includeInTotal');
assert(!Object.prototype.hasOwnProperty.call(exportedSavings, 'currentBalance'),
    'export omits currentBalance');
assert(!Object.prototype.hasOwnProperty.call(exportedSavings, 'id'), 'export omits savings id');
assertEqual(
    Object.keys(exportedSavings).sort(),
    ['amount', 'balanceOverrides', 'endDate', 'endMonth', 'includeInTotal', 'monthlyContribution', 'name', 'rate', 'startDate', 'startMonth'].sort(),
    'savings export key set'
);
assertEqual(exportedSavings.balanceOverrides, {}, 'savings export empty balanceOverrides by default');

const savingsOverrideField = SAVINGS_FIELDS.find((f) => f.key === 'balanceOverrides');
assert(savingsOverrideField?.export && savingsOverrideField?.import, 'savings balanceOverrides is export/import');
assert(!savingsOverrideField.form && !savingsOverrideField.table && !savingsOverrideField.detail,
    'savings balanceOverrides stays off form/table/detail');

const exportedWithOverrides = serializeEntity(
    { ...sampleSavings, balanceOverrides: { '2024-06': 12500 } },
    SAVINGS_FIELDS
);
assertEqual(exportedWithOverrides.balanceOverrides, { '2024-06': 12500 }, 'export savings balanceOverrides map');

const hydratedWithOverrides = hydrateEntity(
    { amount: 1000, balanceOverrides: { '2025-01': 2000, bad: 3 } },
    SAVINGS_FIELDS
);
assertEqual(hydratedWithOverrides.balanceOverrides['2025-01'], 2000, 'hydrate keeps YYYY-MM override');

const excludedExported = serializeEntity(
    { ...sampleSavings, includeInTotal: false },
    SAVINGS_FIELDS
);
assertEqual(excludedExported.includeInTotal, false, 'export includeInTotal false');

const hydratedSavings = hydrateEntity(
    {
        name: 'Brokerage',
        amount: 5000,
        monthlyContribution: 100,
        rate: 8,
        startDate: '2025-01',
        startMonth: 1,
        endDate: '2026-01',
        endMonth: 13,
    },
    SAVINGS_FIELDS
);
assertEqual(hydratedSavings.amount, 5000, 'hydrate savings amount');
assertEqual(hydratedSavings.endMonth, 13, 'hydrate savings endMonth');
assert(!Object.prototype.hasOwnProperty.call(hydratedSavings, 'currentBalance'),
    'hydrate skips computed currentBalance');

// --- savingsBalanceAsOf ---

const zeroRateSavings = calc.savingsBalanceAsOf(
    { amount: 1000, monthlyContribution: 100, rate: 0, startDate: '2026-01' },
    new Date(2026, 2, 15) // March 2026 → 3 growth months (Jan, Feb, Mar)
);
// month1: 1100, month2: 1200, month3: 1300
assertClose(zeroRateSavings, 1300, 'zero-rate savings after 3 months');

const futureSavings = calc.savingsBalanceAsOf(
    { amount: 5000, monthlyContribution: 100, rate: 5, startDate: '2030-01' },
    new Date(2026, 6, 15)
);
assertEqual(futureSavings, 5000, 'future-start savings balance equals amount');

const frozenAtEnd = calc.savingsBalanceAsOf(
    {
        amount: 1000,
        monthlyContribution: 100,
        rate: 0,
        startDate: '2026-01',
        endDate: '2026-02',
    },
    new Date(2026, 5, 15) // June — past end
);
// Jan: 1100, Feb: 1200, then freeze
assertClose(frozenAtEnd, 1200, 'savings freezes at endDate balance');

const ongoingPastFreezePoint = calc.savingsBalanceAsOf(
    {
        amount: 1000,
        monthlyContribution: 100,
        rate: 0,
        startDate: '2026-01',
    },
    new Date(2026, 5, 15)
);
assertClose(ongoingPastFreezePoint, 1600, 'ongoing savings keeps growing past where freeze would be');

// balanceOverrides: Mar forced to 2000 → Apr grows +100 → 2100
const overriddenSavings = calc.savingsBalanceAsOf(
    {
        amount: 1000,
        monthlyContribution: 100,
        rate: 0,
        startDate: '2026-01',
        balanceOverrides: { '2026-03': 2000 },
    },
    new Date(2026, 3, 15) // April
);
assertClose(overriddenSavings, 2100, 'savings balanceOverrides reset ending balance and affect later months');

const overriddenLoan = calc.remainingBalanceAsOf(
    {
        amount: 12000,
        rate: 0,
        monthlyPayment: 1000,
        startDate: '2026-01',
        balanceOverrides: { '2026-02': 5000 },
    },
    new Date(2026, 2, 15) // March: Feb override 5000, then one $1000 payment
);
assertClose(overriddenLoan, 4000, 'loan balanceOverrides reset ending balance and affect later months');

{
    const states = [
        {
            amount: 1000, monthlyContribution: 0, rate: 0, startMonth: 1, includeInTotal: true,
            balance: 0, started: false, endMonth: null, cumulativeInterest: 0, cumulativeContributions: 0
        },
        {
            amount: 500, monthlyContribution: 0, rate: 0, startMonth: 1, includeInTotal: false,
            balance: 0, started: false, endMonth: null, cumulativeInterest: 0, cumulativeContributions: 0
        },
    ];
    const step = calc.calculateSavingsBalances(states, 1);
    assertClose(step.totalBalance, 1000, 'includeInTotal false omitted from total');
    assertClose(states[1].balance, 500, 'excluded account still tracks its own balance');
}

{
    const baseDate = new Date(2026, 0, 1);
    const states = [{
        amount: 1000,
        monthlyContribution: 0,
        rate: 0,
        startMonth: 1,
        includeInTotal: true,
        balanceOverrides: { '2026-01': 2500 },
        balance: 0,
        started: false,
        endMonth: null,
        cumulativeInterest: 0,
        cumulativeContributions: 0
    }];
    const step = calc.calculateSavingsBalances(states, 1, baseDate);
    assertClose(step.totalBalance, 2500, 'calculateSavingsBalances applies balanceOverrides');
}

const balanceViaSavingsSchema = getFieldDisplayValue(currentBalanceField, sampleSavings, {
    calculator: calc,
    asOfDate: new Date('2024-01-15'),
    baseDate: new Date('2024-01-01'),
});
assert(
    typeof balanceViaSavingsSchema === 'string' && balanceViaSavingsSchema.startsWith('$'),
    `currentBalance display is currency string, got ${balanceViaSavingsSchema}`
);

const savingsForm = { innerHTML: '' };
renderFormFields(savingsForm, SAVINGS_FIELDS);
assert(savingsForm.innerHTML.includes('id="savingsName"'), 'form renders savingsName');
assert(savingsForm.innerHTML.includes('id="savingsMonthly"'), 'form renders savingsMonthly');
assert(savingsForm.innerHTML.includes('id="savingsEndDate"'), 'form renders savingsEndDate');
assert(savingsForm.innerHTML.includes('id="savingsIncludeInTotal"'), 'form renders savingsIncludeInTotal');
assert(savingsForm.innerHTML.includes('type="checkbox"'), 'includeInTotal is a checkbox');
assert(!savingsForm.innerHTML.includes('currentBalance'), 'form does not render currentBalance');
assert(
    (savingsForm.innerHTML.match(/sheet-ruled-row input-row/g) || []).length === 7,
    'savings form renders seven input rows'
);

// --- summary ---

if (failed) {
    console.error(`field-model tests: ${failed} failed, ${passed} passed`);
    process.exitCode = 1;
} else {
    console.log(`field-model tests OK (${passed} assertions)`);
}
