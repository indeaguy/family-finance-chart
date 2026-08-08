/**
 * In-memory loans/savings/overrides store plus JSON import/export and loan payment validation.
 * Defines globals: DataManager, LOAN_FIELDS, SAVINGS_FIELDS
 * Depends on: field-model.js (serializeEntity, hydrateEntity); FinanceCalculator (injected);
 *   default_config/example-default-loans.js (DEFAULT_EXAMPLE_DATA);
 *   DOM projection/chart-header fields when exporting (#startDate, #timePeriod, #goalAmount,
 *   #chartTitle, etc.)
 * Owns: loans[], savingsAccounts[], financialOverrides[]; createLoan / addLoan / updateLoan / removeLoan;
 *   createSavingsAccount / addSavingsAccount / updateSavingsAccount / removeSavingsAccount;
 *   entity balanceOverrides CRUD helpers; exportData / importData; loadDefaultExampleIfNeeded (DEFAULT_EXAMPLE_DATA)
 *
 * Field schemas live with their owner store. LOAN_FIELDS / SAVINGS_FIELDS drive
 * form/table/detail/JSON via field-model helpers.
 */

/** @type {Array<object>} */
const LOAN_FIELDS = [
    {
        key: 'name',
        label: 'Name',
        type: 'text',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 0,
        tableOrder: 0,
        detailOrder: 0,
        domId: 'loanName',
        formLabel: 'Name',
        default: '',
        inputAttrs: { placeholder: 'e.g. Mortgage', maxlength: '40' },
        display: (loan) => {
            const n = loan.name && String(loan.name).trim();
            if (n) return n;
            const amt = Number(loan.amount);
            if (Number.isFinite(amt) && amt > 0) {
                return '$' + amt.toLocaleString('en-US', { maximumFractionDigits: 0 });
            }
            return '—';
        }
    },
    {
        key: 'amount',
        label: 'Amount',
        type: 'currency',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        domId: 'loanAmount',
        formLabel: 'Amount ($)',
        default: 200000,
        inputAttrs: { min: '0' }
    },
    {
        key: 'rate',
        label: 'Rate',
        type: 'percent',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        domId: 'loanRate',
        formLabel: 'Rate (%)',
        default: 4.5,
        inputAttrs: { min: '0', max: '30', step: '0.1' }
    },
    {
        key: 'term',
        label: 'Term',
        type: 'years',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        domId: 'loanTerm',
        formLabel: 'Term (years)',
        default: 30,
        inputAttrs: { min: '1', max: '50' },
        display: (loan, ctx) => {
            if (ctx && ctx.surface === 'detail') return `${loan.term} years`;
            return `${loan.term}yr`;
        }
    },
    {
        key: 'startDate',
        label: 'Start',
        type: 'month',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 4,
        tableOrder: 5,
        detailOrder: 4,
        domId: 'loanStartDate',
        formLabel: 'Start Date',
        default: '',
        display: (loan, ctx) => {
            const baseDate = ctx && ctx.baseDate ? ctx.baseDate : null;
            if (loan.startDate) {
                return new Date(loan.startDate + '-01').toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short'
                });
            }
            if (!baseDate) return '—';
            const startDateObj = new Date(baseDate);
            startDateObj.setMonth(startDateObj.getMonth() + (loan.startMonth || 1) - 1);
            return startDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        }
    },
    {
        key: 'monthlyPayment',
        label: 'Pay',
        type: 'currency',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 5,
        tableOrder: 4,
        detailOrder: 5,
        domId: 'loanMonthlyPayment',
        formLabel: 'Payment ($)',
        default: '',
        inputAttrs: { min: '0', placeholder: 'Auto-calc' },
        detailLabel: (loan) => (loan.isCustomPayment ? 'Custom payment' : 'Min payment'),
        // Preserve export quirk: null when not a custom payment
        exportValue: (loan) => (loan.isCustomPayment ? loan.monthlyPayment : null)
    },
    {
        key: 'isCustomPayment',
        label: 'Custom payment',
        type: 'boolean',
        form: false,
        table: false,
        detail: false,
        export: true,
        import: true,
        default: false
    },
    {
        key: 'startMonth',
        label: 'Start month',
        type: 'number',
        form: false,
        table: false,
        detail: false,
        export: true,
        import: true,
        default: 1
    },
    {
        // YYYY-MM → ending balance for that calendar month; subsequent months amortize from it.
        key: 'balanceOverrides',
        label: 'Balance overrides',
        type: 'object',
        form: false,
        table: false,
        detail: false,
        export: true,
        import: true,
        default: {},
        exportValue: (loan) => {
            const map = loan.balanceOverrides;
            if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
            return map;
        }
    },
    {
        key: 'calculatedPayment',
        label: 'Calculated min',
        type: 'currency',
        form: false,
        table: false,
        detail: true,
        detailOrder: 6,
        export: false,
        import: false
    },
    {
        key: 'remainingBalance',
        label: 'Balance',
        type: 'currency',
        form: false,
        table: true,
        detail: true,
        tableOrder: 6,
        detailOrder: 7,
        export: false,
        import: false,
        computed: true,
        compute: (loan, ctx) => {
            if (!ctx || !ctx.calculator) return loan.amount;
            return ctx.calculator.remainingBalanceAsOf(loan, ctx.asOfDate || new Date(), ctx.baseDate);
        }
    },
    {
        key: 'id',
        label: 'Id',
        type: 'number',
        form: false,
        table: false,
        detail: false,
        export: false,
        import: false
    }
];

/** @type {Array<object>} */
const SAVINGS_FIELDS = [
    {
        key: 'name',
        label: 'Name',
        type: 'text',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 0,
        tableOrder: 0,
        detailOrder: 0,
        domId: 'savingsName',
        formLabel: 'Name',
        default: '',
        inputAttrs: { placeholder: 'e.g. Emergency Fund', maxlength: '40' },
        display: (account) => {
            const n = account.name && String(account.name).trim();
            let label = n;
            if (!label) {
                const amt = Number(account.amount);
                if (Number.isFinite(amt) && amt > 0) {
                    label = '$' + amt.toLocaleString('en-US', { maximumFractionDigits: 0 });
                } else {
                    label = '—';
                }
            }
            // Table has no includeInTotal column — mark spend-apart accounts in the name.
            if (account.includeInTotal === false) {
                return label + ' (excl.)';
            }
            return label;
        }
    },
    {
        key: 'amount',
        label: 'Amount',
        type: 'currency',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 1,
        tableOrder: 1,
        detailOrder: 1,
        domId: 'savingsAmount',
        formLabel: 'Initial Amount ($)',
        default: 10000,
        inputAttrs: { min: '0' }
    },
    {
        key: 'monthlyContribution',
        label: 'Mo',
        type: 'currency',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 2,
        tableOrder: 2,
        detailOrder: 2,
        domId: 'savingsMonthly',
        formLabel: 'Monthly ($)',
        default: 500,
        inputAttrs: { min: '0' },
        detailLabel: 'Monthly contribution'
    },
    {
        key: 'rate',
        label: 'Rate',
        type: 'percent',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 3,
        tableOrder: 3,
        detailOrder: 3,
        domId: 'savingsRate',
        formLabel: 'Interest Rate (%)',
        default: 5,
        inputAttrs: { min: '0', max: '50', step: '0.1' }
    },
    {
        key: 'startDate',
        label: 'Start',
        type: 'month',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 4,
        tableOrder: 4,
        detailOrder: 4,
        domId: 'savingsStartDate',
        formLabel: 'Start Date',
        default: '',
        display: (account, ctx) => {
            const baseDate = ctx && ctx.baseDate ? ctx.baseDate : null;
            if (account.startDate) {
                return new Date(account.startDate + '-01').toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short'
                });
            }
            if (!baseDate) return '—';
            const startDateObj = new Date(baseDate);
            startDateObj.setMonth(startDateObj.getMonth() + (account.startMonth || 1) - 1);
            return startDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        }
    },
    {
        key: 'endDate',
        label: 'End',
        type: 'month',
        form: true,
        table: true,
        detail: true,
        export: true,
        import: true,
        formOrder: 5,
        tableOrder: 5,
        detailOrder: 5,
        domId: 'savingsEndDate',
        formLabel: 'End Date (optional)',
        default: '',
        inputAttrs: { },
        display: (account, ctx) => {
            if (!account.endDate && (account.endMonth == null || account.endMonth === '')) {
                return ctx && ctx.surface === 'detail' ? 'None (ongoing)' : '—';
            }
            if (account.endDate) {
                return new Date(account.endDate + '-01').toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short'
                });
            }
            const baseDate = ctx && ctx.baseDate ? ctx.baseDate : null;
            if (!baseDate || account.endMonth == null) return '—';
            const endDateObj = new Date(baseDate);
            endDateObj.setMonth(endDateObj.getMonth() + account.endMonth - 1);
            return endDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        },
        // Empty end date means ongoing — export null rather than ""
        exportValue: (account) => (account.endDate ? account.endDate : null)
    },
    {
        key: 'includeInTotal',
        label: 'In total',
        type: 'boolean',
        form: true,
        table: false,
        detail: true,
        export: true,
        import: true,
        formOrder: 6,
        detailOrder: 6,
        domId: 'savingsIncludeInTotal',
        formLabel: 'Include in Total Savings',
        default: true,
        detailLabel: 'Counts toward Total Savings',
        display: (account) => (account.includeInTotal === false ? 'No' : 'Yes')
    },
    {
        key: 'startMonth',
        label: 'Start month',
        type: 'number',
        form: false,
        table: false,
        detail: false,
        export: true,
        import: true,
        default: 1
    },
    {
        key: 'endMonth',
        label: 'End month',
        type: 'number',
        form: false,
        table: false,
        detail: false,
        export: true,
        import: true,
        default: null,
        exportValue: (account) => (account.endMonth != null ? account.endMonth : null)
    },
    {
        // YYYY-MM → ending balance for that calendar month; subsequent months grow from it.
        key: 'balanceOverrides',
        label: 'Balance overrides',
        type: 'object',
        form: false,
        table: false,
        detail: false,
        export: true,
        import: true,
        default: {},
        exportValue: (account) => {
            const map = account.balanceOverrides;
            if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
            return map;
        }
    },
    {
        key: 'currentBalance',
        label: 'Balance',
        type: 'currency',
        form: false,
        table: true,
        detail: true,
        tableOrder: 6,
        detailOrder: 7,
        export: false,
        import: false,
        computed: true,
        compute: (account, ctx) => {
            if (!ctx || !ctx.calculator) return account.amount;
            return ctx.calculator.savingsBalanceAsOf(account, ctx.asOfDate || new Date(), ctx.baseDate);
        }
    },
    {
        key: 'id',
        label: 'Id',
        type: 'number',
        form: false,
        table: false,
        detail: false,
        export: false,
        import: false
    }
];

class DataManager {
    constructor() {
        this.loans = [];
        this.savingsAccounts = [];
        this.overrides = {};
        this.calculator = null; // Will be injected by app
        // Once the user imports JSON, never replace demo data with the static default example.
        this.hasUserImport = false;
    }
    
    setCalculator(calculator) {
        this.calculator = calculator;
    }

    getLoanFieldContext() {
        return this.getProjectionFieldContext();
    }

    getSavingsFieldContext() {
        return this.getProjectionFieldContext();
    }

    getProjectionFieldContext() {
        const savingsStartDate = document.getElementById('startDate')?.value;
        const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
        return {
            calculator: this.calculator,
            baseDate,
            asOfDate: new Date()
        };
    }
    
    // Loan Management
    getLoans() {
        return this.loans;
    }

    getLoanById(loanId) {
        return this.loans.find(loan => loan.id === loanId) || null;
    }
    
    addLoan(loan) {
        this.loans.push(loan);
    }
    
    removeLoan(loanId) {
        this.loans = this.loans.filter(loan => loan.id !== loanId);
    }

    /** Replace an existing loan; keeps id. Returns null if missing or createLoan cancelled. */
    updateLoan(loanId, loanData) {
        const index = this.loans.findIndex(loan => loan.id === loanId);
        if (index < 0) return null;

        const updated = this.createLoan(loanData);
        if (!updated) return null;

        updated.id = loanId;
        this.loans[index] = updated;
        return updated;
    }
    
    clearAllLoans() {
        this.loans = [];
    }
    
    createLoan(loanData) {
        const calculatedPayment = this.calculator.calculateMonthlyPayment(
            loanData.amount, 
            loanData.rate, 
            loanData.term
        );
        
        const monthlyPayment = loanData.isCustomPayment && loanData.customPayment 
            ? loanData.customPayment 
            : calculatedPayment;
        
        // Validate custom payment
        if (loanData.isCustomPayment && loanData.customPayment < calculatedPayment) {
            const proceed = confirm(
                `Warning: Your custom payment ($${loanData.customPayment.toLocaleString()}) is less than the minimum required payment ($${calculatedPayment.toLocaleString()}). ` +
                `This loan may never be fully paid off. Do you want to continue?`
            );
            if (!proceed) return null;
        }
        
        const name = loanData.name && String(loanData.name).trim();

        return {
            id: Date.now(),
            name: name || '',
            amount: loanData.amount,
            rate: loanData.rate,
            term: loanData.term,
            startMonth: loanData.startMonth,
            startDate: loanData.startDate,
            monthlyPayment: monthlyPayment,
            calculatedPayment: calculatedPayment,
            isCustomPayment: loanData.isCustomPayment || false,
            balanceOverrides: this.normalizeBalanceOverrides(loanData.balanceOverrides)
        };
    }

    // Savings account management
    getSavingsAccounts() {
        return this.savingsAccounts;
    }

    getSavingsAccountById(accountId) {
        return this.savingsAccounts.find(account => account.id === accountId) || null;
    }

    addSavingsAccount(account) {
        this.savingsAccounts.push(account);
    }

    removeSavingsAccount(accountId) {
        this.savingsAccounts = this.savingsAccounts.filter(account => account.id !== accountId);
    }

    /** Replace an existing savings account; keeps id. Returns null if missing. */
    updateSavingsAccount(accountId, accountData) {
        const index = this.savingsAccounts.findIndex(account => account.id === accountId);
        if (index < 0) return null;

        const updated = this.createSavingsAccount(accountData);
        updated.id = accountId;
        this.savingsAccounts[index] = updated;
        return updated;
    }

    clearAllSavingsAccounts() {
        this.savingsAccounts = [];
    }

    createSavingsAccount(accountData) {
        const name = accountData.name && String(accountData.name).trim();
        return {
            id: Date.now(),
            name: name || '',
            amount: accountData.amount,
            monthlyContribution: accountData.monthlyContribution || 0,
            rate: accountData.rate || 0,
            startMonth: accountData.startMonth || 1,
            startDate: accountData.startDate || '',
            endMonth: accountData.endMonth != null ? accountData.endMonth : null,
            endDate: accountData.endDate || '',
            includeInTotal: accountData.includeInTotal !== false,
            balanceOverrides: this.normalizeBalanceOverrides(accountData.balanceOverrides)
        };
    }

    /** Keep only YYYY-MM → finite number entries for entity balanceOverrides. */
    normalizeBalanceOverrides(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const out = {};
        Object.entries(raw).forEach(([key, value]) => {
            if (!/^\d{4}-\d{2}$/.test(key)) return;
            const n = Number(value);
            if (!Number.isFinite(n)) return;
            out[key] = n;
        });
        return out;
    }

    getEntityByKind(kind, entityId) {
        return kind === 'loan'
            ? this.getLoanById(entityId)
            : this.getSavingsAccountById(entityId);
    }

    getEntityBalanceOverrides(kind, entityId) {
        const entity = this.getEntityByKind(kind, entityId);
        return entity ? this.normalizeBalanceOverrides(entity.balanceOverrides) : {};
    }

    /** Set or replace a YYYY-MM ending balance on a loan or savings account. */
    setEntityBalanceOverride(kind, entityId, yyyyMm, amount) {
        const entity = this.getEntityByKind(kind, entityId);
        if (!entity || !/^\d{4}-\d{2}$/.test(yyyyMm)) return null;
        const n = Number(amount);
        if (!Number.isFinite(n)) return null;
        entity.balanceOverrides = this.normalizeBalanceOverrides(entity.balanceOverrides);
        entity.balanceOverrides[yyyyMm] = n;
        return entity;
    }

    removeEntityBalanceOverride(kind, entityId, yyyyMm) {
        const entity = this.getEntityByKind(kind, entityId);
        if (!entity) return null;
        entity.balanceOverrides = this.normalizeBalanceOverrides(entity.balanceOverrides);
        delete entity.balanceOverrides[yyyyMm];
        return entity;
    }
    
    // Override Management
    getOverrides() {
        return this.overrides;
    }
    
    addOverride(month, savings, loanBalance) {
        this.overrides[month] = {
            savings: savings,
            loanBalance: loanBalance
        };
    }
    
    removeOverride(month) {
        delete this.overrides[month];
    }
    
    clearAllOverrides() {
        this.overrides = {};
    }
    
    // Data Export/Import
    exportData() {
        return {
            savings: {
                startDate: document.getElementById('startDate')?.value || '',
                timePeriod: parseInt(document.getElementById('timePeriod')?.value, 10) || 1,
                goalAmount: parseFloat(document.getElementById('goalAmount')?.value) || 0,
                financialOverrides: this.overrides,
                accounts: this.savingsAccounts.map(account => serializeEntity(account, SAVINGS_FIELDS))
            },
            chartHeader: {
                title: document.getElementById('chartTitle')?.value || 'Family Finance Growth',
                subtitle: document.getElementById('chartSubtitle')?.value || 'Interactive financial projection',
                background: document.getElementById('chartHeaderBg')?.value || 'gradient',
                position: document.getElementById('chartHeaderPos')?.value || 'top-left',
                visible: document.getElementById('chartHeaderVisible')?.value === 'true'
            },
            loans: this.loans.map(loan => serializeEntity(loan, LOAN_FIELDS)),
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
    }
    
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.hasUserImport = true;
                    this.loadDataFromJSON(data);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Load demo loans/savings from DEFAULT_EXAMPLE_DATA (default_config/example-default-loans.js)
     * when the user has not imported their own file. Requires calculator injected first.
     */
    loadDefaultExampleIfNeeded() {
        if (this.hasUserImport) return false;

        const data = typeof DEFAULT_EXAMPLE_DATA !== 'undefined' ? DEFAULT_EXAMPLE_DATA : null;
        const hasLoans = data && Array.isArray(data.loans);
        const hasAccounts = data && (
            (data.savings && Array.isArray(data.savings.accounts)) ||
            Array.isArray(data.savingsAccounts)
        );
        if (!data || (!hasLoans && !hasAccounts)) {
            console.warn('Could not load default example data: DEFAULT_EXAMPLE_DATA missing');
            return false;
        }

        this.loadDataFromJSON(data);
        return true;
    }
    
    loadDataFromJSON(data) {
        try {
            const savingsStartDate = document.getElementById('startDate')?.value;
            const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();

            // Load savings projection meta + accounts
            if (data.savings) {
                // Load financial overrides with backward compatibility
                this.overrides = data.savings.financialOverrides || 
                                data.savings.netWorthOverrides || 
                                data.savings.monthlyOverrides || {};
                
                // Convert old format to new format
                Object.entries(this.overrides).forEach(([month, value]) => {
                    if (typeof value !== 'object') {
                        this.overrides[month] = {
                            savings: value,
                            loanBalance: 0
                        };
                    }
                });
            }

            const accountSource = (data.savings && Array.isArray(data.savings.accounts))
                ? data.savings.accounts
                : (Array.isArray(data.savingsAccounts) ? data.savingsAccounts : null);

            if (accountSource) {
                this.savingsAccounts = accountSource.map((accountData, index) =>
                    this.hydrateSavingsAccount(accountData, index, baseDate)
                );
            } else if (data.savings && (
                data.savings.initialAmount != null ||
                data.savings.monthlySavings != null ||
                data.savings.interestRate != null
            )) {
                // Legacy singular savings form → one account
                this.savingsAccounts = [this.hydrateSavingsAccount({
                    name: 'Savings',
                    amount: data.savings.initialAmount || 0,
                    monthlyContribution: data.savings.monthlySavings || 0,
                    rate: data.savings.interestRate || 0,
                    startMonth: 1,
                    startDate: data.savings.startDate || '',
                    endDate: null,
                    endMonth: null
                }, 0, baseDate)];
            }
            
            // Load loans data
            if (data.loans && Array.isArray(data.loans)) {
                this.loans = data.loans.map((loanData, index) => {
                    const hydrated = hydrateEntity(loanData, LOAN_FIELDS);

                    const calculatedPayment = this.calculator.calculateMonthlyPayment(
                        hydrated.amount, 
                        hydrated.rate, 
                        hydrated.term
                    );
                    
                    const monthlyPayment = hydrated.isCustomPayment && hydrated.monthlyPayment 
                        ? hydrated.monthlyPayment 
                        : calculatedPayment;
                    
                    // Handle start date
                    let startDate = hydrated.startDate;
                    let startMonth = hydrated.startMonth || 1;
                    
                    if (!startDate && startMonth) {
                        const calculatedDate = new Date(baseDate);
                        calculatedDate.setMonth(calculatedDate.getMonth() + startMonth - 1);
                        startDate = calculatedDate.toISOString().slice(0, 7);
                    }
                    
                    const name = hydrated.name && String(hydrated.name).trim();

                    return {
                        id: Date.now() + index,
                        name: name || '',
                        amount: hydrated.amount,
                        rate: hydrated.rate,
                        term: hydrated.term,
                        startMonth: startMonth,
                        startDate: startDate,
                        monthlyPayment: monthlyPayment,
                        calculatedPayment: calculatedPayment,
                        isCustomPayment: hydrated.isCustomPayment || false,
                        balanceOverrides: this.normalizeBalanceOverrides(hydrated.balanceOverrides)
                    };
                });
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    hydrateSavingsAccount(accountData, index, baseDate) {
        const hydrated = hydrateEntity(accountData, SAVINGS_FIELDS);
        let startDate = hydrated.startDate || '';
        let startMonth = hydrated.startMonth || 1;
        let endDate = hydrated.endDate || '';
        let endMonth = hydrated.endMonth != null ? hydrated.endMonth : null;

        if (!startDate && startMonth) {
            const calculatedDate = new Date(baseDate);
            calculatedDate.setMonth(calculatedDate.getMonth() + startMonth - 1);
            startDate = calculatedDate.toISOString().slice(0, 7);
        }

        if (!endDate && endMonth != null) {
            const calculatedDate = new Date(baseDate);
            calculatedDate.setMonth(calculatedDate.getMonth() + endMonth - 1);
            endDate = calculatedDate.toISOString().slice(0, 7);
        }

        if (endDate && (endMonth == null)) {
            endMonth = this.calculateStartMonth(endDate, baseDate);
        }

        const name = hydrated.name && String(hydrated.name).trim();

        return {
            id: Date.now() + index,
            name: name || '',
            amount: hydrated.amount || 0,
            monthlyContribution: hydrated.monthlyContribution || 0,
            rate: hydrated.rate || 0,
            startMonth,
            startDate,
            endMonth,
            endDate,
            includeInTotal: hydrated.includeInTotal !== false,
            balanceOverrides: this.normalizeBalanceOverrides(hydrated.balanceOverrides)
        };
    }
    
    // Utility methods
    calculateStartMonth(startDate, baseDate) {
        if (!startDate || !baseDate) return 1;
        
        const loanStartDate = new Date(startDate + '-01');
        return (loanStartDate.getFullYear() - baseDate.getFullYear()) * 12 + 
               (loanStartDate.getMonth() - baseDate.getMonth()) + 1;
    }
}
