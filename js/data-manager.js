/**
 * In-memory loans/overrides store plus JSON import/export and loan payment validation.
 * Defines globals: DataManager, LOAN_FIELDS
 * Depends on: field-model.js (serializeEntity, hydrateEntity); FinanceCalculator (injected);
 *   DOM savings/chart-header fields when exporting (#startDate, #initialAmount,
 *   #monthlySavings, #interestRate, #timePeriod, #goalAmount, #chartTitle, etc.)
 * Owns: loans[], financialOverrides[]; createLoan / addLoan / removeLoan / exportData / importData
 *
 * Field schemas live with their owner store. LOAN_FIELDS drives form/table/detail/JSON via
 * field-model helpers; next entity should add its own *_FIELDS array the same way.
 */

/** @type {Array<object>} */
const LOAN_FIELDS = [
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
        // Temporary dummy loans so the Active Loans table overflows the pocket (scroll demo).
        this.loans = [
            { id: 9001, amount: 320000, rate: 6.5, term: 30, startMonth: 1, startDate: '', monthlyPayment: 2022, calculatedPayment: 2022, isCustomPayment: false },
            { id: 9002, amount: 28000, rate: 4.9, term: 5, startMonth: 1, startDate: '', monthlyPayment: 527, calculatedPayment: 527, isCustomPayment: false },
            { id: 9003, amount: 8500, rate: 19.9, term: 4, startMonth: 3, startDate: '', monthlyPayment: 260, calculatedPayment: 260, isCustomPayment: false },
            { id: 9004, amount: 15000, rate: 7.2, term: 6, startMonth: 2, startDate: '', monthlyPayment: 256, calculatedPayment: 256, isCustomPayment: false },
            { id: 9005, amount: 4200, rate: 0, term: 2, startMonth: 1, startDate: '', monthlyPayment: 175, calculatedPayment: 175, isCustomPayment: false },
            { id: 9006, amount: 12000, rate: 5.5, term: 3, startMonth: 4, startDate: '', monthlyPayment: 362, calculatedPayment: 362, isCustomPayment: false },
            { id: 9007, amount: 45000, rate: 3.9, term: 7, startMonth: 1, startDate: '', monthlyPayment: 612, calculatedPayment: 612, isCustomPayment: false },
            { id: 9008, amount: 9500, rate: 11.5, term: 5, startMonth: 2, startDate: '', monthlyPayment: 209, calculatedPayment: 209, isCustomPayment: false },
            { id: 9009, amount: 2200, rate: 0, term: 1, startMonth: 1, startDate: '', monthlyPayment: 183, calculatedPayment: 183, isCustomPayment: false },
            { id: 9010, amount: 185000, rate: 5.25, term: 15, startMonth: 6, startDate: '', monthlyPayment: 1486, calculatedPayment: 1486, isCustomPayment: false },
            { id: 9011, amount: 6400, rate: 8.9, term: 4, startMonth: 3, startDate: '', monthlyPayment: 159, calculatedPayment: 159, isCustomPayment: false },
            { id: 9012, amount: 31000, rate: 6.1, term: 6, startMonth: 1, startDate: '', monthlyPayment: 515, calculatedPayment: 515, isCustomPayment: false },
            { id: 9013, amount: 1100, rate: 22.9, term: 2, startMonth: 5, startDate: '', monthlyPayment: 58, calculatedPayment: 58, isCustomPayment: false },
            { id: 9014, amount: 75000, rate: 4.2, term: 10, startMonth: 2, startDate: '', monthlyPayment: 767, calculatedPayment: 767, isCustomPayment: false },
            { id: 9015, amount: 18000, rate: 9.4, term: 5, startMonth: 4, startDate: '', monthlyPayment: 377, calculatedPayment: 377, isCustomPayment: false },
            { id: 9016, amount: 5500, rate: 14.9, term: 3, startMonth: 1, startDate: '', monthlyPayment: 190, calculatedPayment: 190, isCustomPayment: false },
            { id: 9017, amount: 99000, rate: 5.8, term: 12, startMonth: 8, startDate: '', monthlyPayment: 958, calculatedPayment: 958, isCustomPayment: false },
            { id: 9018, amount: 3400, rate: 0, term: 2, startMonth: 2, startDate: '', monthlyPayment: 142, calculatedPayment: 142, isCustomPayment: false }
        ];
        this.overrides = {};
        this.calculator = null; // Will be injected by app
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
        
        return {
            id: Date.now(),
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
                    
                    return {
                        id: Date.now() + index,
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
