/**
 * In-memory loans/overrides store plus JSON import/export and loan payment validation.
 * Defines globals: DataManager, LOAN_FIELDS
 * Depends on: field-model.js (serializeEntity, hydrateEntity); FinanceCalculator (injected);
 *   default_config/example-default-loans.js (DEFAULT_EXAMPLE_DATA);
 *   DOM savings/chart-header fields when exporting (#startDate, #initialAmount,
 *   #monthlySavings, #interestRate, #timePeriod, #goalAmount, #chartTitle, etc.)
 * Owns: loans[], financialOverrides[]; createLoan / addLoan / removeLoan / exportData / importData
 *   loadDefaultExampleIfNeeded (reads DEFAULT_EXAMPLE_DATA from default_config/example-default-loans.js)
 *
 * Field schemas live with their owner store. LOAN_FIELDS drives form/table/detail/JSON via
 * field-model helpers; next entity should add its own *_FIELDS array the same way.
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

class DataManager {
    constructor() {
        this.loans = [];
        this.overrides = {};
        this.calculator = null; // Will be injected by app
        // Once the user imports JSON, never replace loans with the static default example.
        this.hasUserImport = false;
    }
    
    setCalculator(calculator) {
        this.calculator = calculator;
    }

    getLoanFieldContext() {
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
            isCustomPayment: loanData.isCustomPayment || false
        };
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
                startDate: document.getElementById('startDate').value,
                initialAmount: parseFloat(document.getElementById('initialAmount').value) || 0,
                monthlySavings: parseFloat(document.getElementById('monthlySavings').value) || 0,
                interestRate: parseFloat(document.getElementById('interestRate').value) || 0,
                timePeriod: parseInt(document.getElementById('timePeriod').value) || 1,
                goalAmount: parseFloat(document.getElementById('goalAmount').value) || 0,
                financialOverrides: this.overrides
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
     * Load demo loans from DEFAULT_EXAMPLE_DATA (default_config/example-default-loans.js)
     * when the user has not imported their own file. Requires calculator injected first.
     */
    loadDefaultExampleIfNeeded() {
        if (this.hasUserImport) return false;

        const data = typeof DEFAULT_EXAMPLE_DATA !== 'undefined' ? DEFAULT_EXAMPLE_DATA : null;
        if (!data || !Array.isArray(data.loans)) {
            console.warn('Could not load default example loans: DEFAULT_EXAMPLE_DATA missing');
            return false;
        }

        this.loadDataFromJSON(data);
        return true;
    }
    
    loadDataFromJSON(data) {
        try {
            // Load savings data
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
            
            // Load loans data
            if (data.loans && Array.isArray(data.loans)) {
                const savingsStartDate = document.getElementById('startDate').value;
                const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
                
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
                        isCustomPayment: hydrated.isCustomPayment || false
                    };
                });
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }
    
    // Utility methods
    calculateStartMonth(startDate, baseDate) {
        if (!startDate || !baseDate) return 1;
        
        const loanStartDate = new Date(startDate + '-01');
        return (loanStartDate.getFullYear() - baseDate.getFullYear()) * 12 + 
               (loanStartDate.getMonth() - baseDate.getMonth()) + 1;
    }
}
