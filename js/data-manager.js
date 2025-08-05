/**
 * Data Manager Component
 * Handles all data storage and management
 */

class DataManager {
    constructor() {
        this.loans = [];
        this.overrides = {};
        this.calculator = null; // Will be injected by app
    }
    
    setCalculator(calculator) {
        this.calculator = calculator;
    }
    
    // Loan Management
    getLoans() {
        return this.loans;
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
            loans: this.loans.map(loan => ({
                amount: loan.amount,
                rate: loan.rate,
                term: loan.term,
                startMonth: loan.startMonth,
                startDate: loan.startDate,
                monthlyPayment: loan.isCustomPayment ? loan.monthlyPayment : null,
                isCustomPayment: loan.isCustomPayment
            })),
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
                    const calculatedPayment = this.calculator.calculateMonthlyPayment(
                        loanData.amount, 
                        loanData.rate, 
                        loanData.term
                    );
                    
                    const monthlyPayment = loanData.isCustomPayment && loanData.monthlyPayment 
                        ? loanData.monthlyPayment 
                        : calculatedPayment;
                    
                    // Handle start date
                    let startDate = loanData.startDate;
                    let startMonth = loanData.startMonth || 1;
                    
                    if (!startDate && startMonth) {
                        const calculatedDate = new Date(baseDate);
                        calculatedDate.setMonth(calculatedDate.getMonth() + startMonth - 1);
                        startDate = calculatedDate.toISOString().slice(0, 7);
                    }
                    
                    return {
                        id: Date.now() + index,
                        amount: loanData.amount,
                        rate: loanData.rate,
                        term: loanData.term,
                        startMonth: startMonth,
                        startDate: startDate,
                        monthlyPayment: monthlyPayment,
                        calculatedPayment: calculatedPayment,
                        isCustomPayment: loanData.isCustomPayment || false
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
