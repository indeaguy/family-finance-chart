/**
 * Finance Calculator Component
 * Handles all financial calculations
 */

class FinanceCalculator {
    constructor() {
        this.dataManager = null; // Will be injected by app
    }
    
    setDataManager(dataManager) {
        this.dataManager = dataManager;
    }
    
    calculateFinancialGrowth() {
        const params = this.getCalculationParameters();
        const results = this.performCalculations(params);
        return results;
    }
    
    getCalculationParameters() {
        return {
            initialAmount: parseFloat(document.getElementById('initialAmount').value) || 0,
            monthlySavings: parseFloat(document.getElementById('monthlySavings').value) || 0,
            annualRate: parseFloat(document.getElementById('interestRate').value) || 0,
            years: parseInt(document.getElementById('timePeriod').value) || 1,
            goalAmount: parseFloat(document.getElementById('goalAmount').value) || 0,
            startDate: document.getElementById('startDate').value
        };
    }
    
    performCalculations(params) {
        const monthlyRate = params.annualRate / 100 / 12;
        const totalMonths = params.years * 12;
        const baseDate = params.startDate ? new Date(params.startDate + '-01') : new Date();
        
        // Initialize data arrays
        const data = [];
        const savingsData = [];
        const netWorthData = [];
        const netWorthOriginalData = [];
        const loanBalanceData = [];
        const loanPayoffMarkers = [];
        
        // Initialize state
        let currentSavings = params.initialAmount;
        let totalInterestPaid = 0;
        let totalPrincipalPaid = 0;
        let goalReachedMonth = null;
        
        // Get loans and overrides from data manager
        const loans = this.dataManager ? this.dataManager.getLoans() : [];
        const overrides = this.dataManager ? this.dataManager.getOverrides() : {};
        
        // Prepare loan tracking
        const loanPayments = loans.map(loan => ({
            ...loan,
            remainingBalance: loan.amount,
            startMonth: loan.startMonth || 1,
            isPaidOff: false,
            payoffMonth: null
        }));
        
        // Monthly calculations
        for (let month = 1; month <= totalMonths; month++) {
            // Apply compound interest and add monthly savings
            currentSavings = currentSavings * (1 + monthlyRate) + params.monthlySavings;
            
            // Calculate loan payments and balances
            const loanResults = this.calculateLoanPayments(loanPayments, month, baseDate, loanPayoffMarkers);
            currentSavings -= loanResults.monthlyPayment;
            totalInterestPaid += loanResults.interestPaid;
            totalPrincipalPaid += loanResults.principalPaid;
            
            // Apply overrides if they exist
            const overrideResult = this.applyOverrides(overrides, month, currentSavings, loanResults.totalBalance);
            currentSavings = overrideResult.savings;
            const totalLoanBalance = overrideResult.loanBalance;
            
            // Calculate net worth
            const netWorth = currentSavings - totalLoanBalance;
            
            // Create data point
            const dataPoint = this.createDataPoint(
                month, baseDate, currentSavings, netWorth, totalLoanBalance,
                params, totalInterestPaid, totalPrincipalPaid, overrideResult.hasOverride
            );
            
            // Store data
            data.push(dataPoint);
            savingsData.push({ time: dataPoint.timestamp, value: currentSavings });
            netWorthData.push({ time: dataPoint.timestamp, value: netWorth });
            netWorthOriginalData.push({ time: dataPoint.timestamp, value: netWorth });
            
            // Only add loan balance data if there's a balance
            if (totalLoanBalance > 0 || (month > 1 && data[month-2].loanBalance > 0)) {
                loanBalanceData.push({ time: dataPoint.timestamp, value: totalLoanBalance });
            }
            
            // Check if goal is reached
            if (params.goalAmount > 0 && netWorth >= params.goalAmount && !goalReachedMonth) {
                goalReachedMonth = month;
                break;
            }
        }
        
        return {
            data,
            savingsData,
            netWorthData,
            netWorthOriginalData,
            loanBalanceData,
            loanPayoffMarkers,
            finalSavings: currentSavings,
            finalNetWorth: currentSavings - (loanPayments.reduce((sum, loan) => sum + loan.remainingBalance, 0)),
            totalInterestPaid,
            totalPrincipalPaid,
            goalAmount: params.goalAmount,
            goalReachedMonth,
            hasOverrides: Object.keys(overrides).length > 0
        };
    }
    
    calculateLoanPayments(loanPayments, month, baseDate, loanPayoffMarkers) {
        let monthlyPayment = 0;
        let totalBalance = 0;
        let interestPaid = 0;
        let principalPaid = 0;
        
        loanPayments.forEach(loan => {
            if (month >= loan.startMonth && loan.remainingBalance > 0) {
                const monthlyInterest = loan.remainingBalance * (loan.rate / 100 / 12);
                const monthlyPrincipal = Math.min(loan.monthlyPayment - monthlyInterest, loan.remainingBalance);
                
                loan.remainingBalance -= monthlyPrincipal;
                monthlyPayment += monthlyInterest + monthlyPrincipal;
                interestPaid += monthlyInterest;
                principalPaid += monthlyPrincipal;
                
                // Ensure balance doesn't go negative
                if (loan.remainingBalance < 0) loan.remainingBalance = 0;
                
                // Check if loan was just paid off
                if (loan.remainingBalance === 0 && !loan.isPaidOff) {
                    loan.isPaidOff = true;
                    loan.payoffMonth = month;
                    
                    // Create payoff marker
                    const payoffDate = new Date(baseDate);
                    payoffDate.setMonth(payoffDate.getMonth() + month - 1);
                    const payoffTimestamp = Math.floor(payoffDate.getTime() / 1000);
                    
                    loanPayoffMarkers.push({
                        time: payoffTimestamp,
                        position: 'aboveBar',
                        color: '#f44336',
                        shape: 'circle',
                        text: 'Loan Paid Off!'
                    });
                }
            }
            
            if (loan.remainingBalance > 0) {
                totalBalance += loan.remainingBalance;
            }
        });
        
        return {
            monthlyPayment: Math.max(0, monthlyPayment),
            totalBalance,
            interestPaid,
            principalPaid
        };
    }
    
    applyOverrides(overrides, month, currentSavings, currentLoanBalance) {
        if (!overrides[month]) {
            return {
                savings: currentSavings,
                loanBalance: currentLoanBalance,
                hasOverride: false
            };
        }
        
        const override = overrides[month];
        
        // Handle both new format (object) and old format (direct amount)
        if (typeof override === 'object') {
            return {
                savings: override.savings,
                loanBalance: override.loanBalance,
                hasOverride: true
            };
        } else {
            // Old format - calculate savings based on net worth
            return {
                savings: override + currentLoanBalance,
                loanBalance: currentLoanBalance,
                hasOverride: true
            };
        }
    }
    
    createDataPoint(month, baseDate, savings, netWorth, loanBalance, params, totalInterestPaid, totalPrincipalPaid, hasOverride) {
        const date = new Date(baseDate);
        date.setMonth(date.getMonth() + month - 1);
        const timestamp = Math.floor(date.getTime() / 1000);
        
        return {
            time: timestamp,
            month,
            date: date.toISOString().slice(0, 7),
            savings,
            netWorth,
            netWorthOriginal: netWorth,
            loanBalance,
            totalContributions: params.initialAmount + (params.monthlySavings * month),
            interestEarned: savings - (params.initialAmount + (params.monthlySavings * month)) + totalPrincipalPaid,
            totalInterestPaid,
            override: hasOverride,
            timestamp
        };
    }
    
    calculateMonthlyPayment(amount, rate, term) {
        if (rate === 0) {
            return amount / (term * 12);
        }
        
        const monthlyRate = rate / 100 / 12;
        const numPayments = term * 12;
        
        return amount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
               (Math.pow(1 + monthlyRate, numPayments) - 1);
    }
}
