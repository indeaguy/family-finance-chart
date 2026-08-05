/**
 * Compound-interest and loan amortization math; builds chart data points and payoff markers.
 * Defines globals: FinanceCalculator
 * Depends on: DataManager (injected via setDataManager) for loans, savings accounts, overrides;
 *   DOM projection inputs: #timePeriod, #goalAmount, #startDate
 * Owns: calculateMonthlyPayment, remainingBalanceAsOf, savingsBalanceAsOf
 * Note: summary-overlay.js may mirror projection totals; prefer calculator results when available.
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
            years: parseInt(document.getElementById('timePeriod')?.value, 10) || 1,
            goalAmount: parseFloat(document.getElementById('goalAmount')?.value) || 0,
            startDate: document.getElementById('startDate')?.value || ''
        };
    }
    
    performCalculations(params) {
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
        let currentSavings = 0;
        let totalInterestPaid = 0;
        let totalPrincipalPaid = 0;
        let goalReachedMonth = null;
        
        // Get loans, savings accounts, and overrides from data manager
        const loans = this.dataManager ? this.dataManager.getLoans() : [];
        const savingsAccounts = this.dataManager ? this.dataManager.getSavingsAccounts() : [];
        const overrides = this.dataManager ? this.dataManager.getOverrides() : {};
        
        // Prepare loan tracking
        const loanPayments = loans.map(loan => ({
            ...loan,
            remainingBalance: loan.amount,
            startMonth: loan.startMonth || 1,
            isPaidOff: false,
            payoffMonth: null,
            cumulativeInterestPaid: 0
        }));

        const individualLoanSeries = loans.map((loan, index) => ({
            id: loan.id,
            name: (loan.name && String(loan.name).trim()) || `Loan ${index + 1}`,
            data: []
        }));

        // Prepare savings account tracking (balances sum to Total Savings)
        const accountStates = savingsAccounts.map(account => ({
            ...account,
            balance: 0,
            started: false,
            startMonth: account.startMonth || 1,
            endMonth: account.endMonth != null ? account.endMonth : null,
            cumulativeInterest: 0,
            cumulativeContributions: 0
        }));

        const individualSavingsSeries = savingsAccounts.map((account, index) => ({
            id: account.id,
            name: (account.name && String(account.name).trim()) || `Savings ${index + 1}`,
            data: []
        }));
        
        // Monthly calculations
        for (let month = 1; month <= totalMonths; month++) {
            // Grow each savings account (freeze after endMonth at that month's ending value)
            const savingsStep = this.calculateSavingsBalances(accountStates, month);
            currentSavings = savingsStep.totalBalance;
            
            // Calculate loan payments and balances (do not reduce savings — accounts sum to total)
            const loanResults = this.calculateLoanPayments(loanPayments, month, baseDate, loanPayoffMarkers);
            totalInterestPaid += loanResults.interestPaid;
            totalPrincipalPaid += loanResults.principalPaid;
            
            // Apply overrides if they exist
            const overrideResult = this.applyOverrides(overrides, month, currentSavings, loanResults.totalBalance);
            currentSavings = overrideResult.savings;
            const totalLoanBalance = overrideResult.loanBalance;
            
            // Calculate net worth
            const netWorth = currentSavings - totalLoanBalance;

            const totalContributions = accountStates.reduce((sum, account) => {
                if (account.includeInTotal === false) return sum;
                return sum + account.cumulativeContributions;
            }, 0);
            const interestEarned = accountStates.reduce((sum, account) => {
                if (account.includeInTotal === false) return sum;
                return sum + account.cumulativeInterest;
            }, 0);
            
            // Create data point
            const dataPoint = this.createDataPoint(
                month, baseDate, currentSavings, netWorth, totalLoanBalance,
                totalContributions, interestEarned, totalInterestPaid, overrideResult.hasOverride
            );
            
            // Store data
            data.push(dataPoint);
            savingsData.push({ time: dataPoint.timestamp, value: currentSavings });
            netWorthData.push({ time: dataPoint.timestamp, value: netWorth });
            netWorthOriginalData.push({ time: dataPoint.timestamp, value: netWorth });
            
            loanPayments.forEach((loan, index) => {
                if (month < loan.startMonth) return;
                if (loan.isPaidOff && loan.payoffMonth != null && month > loan.payoffMonth) return;
                // interestPaid is for hover axis companions; LC series data only uses time/value.
                individualLoanSeries[index].data.push({
                    time: dataPoint.timestamp,
                    value: loan.remainingBalance,
                    interestPaid: loan.cumulativeInterestPaid
                });
            });

            accountStates.forEach((account, index) => {
                if (month < account.startMonth) return;
                individualSavingsSeries[index].data.push({
                    time: dataPoint.timestamp,
                    value: account.balance,
                    interestEarned: account.cumulativeInterest
                });
            });
            
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
            individualLoanSeries,
            individualSavingsSeries,
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

    /**
     * Advance each savings account one month. After endMonth (inclusive last growth month),
     * balance freezes but still counts toward the total for the rest of the chart
     * (unless includeInTotal is false — earmarked spend, still drawn as its own line).
     */
    calculateSavingsBalances(accountStates, month) {
        let totalBalance = 0;

        accountStates.forEach(account => {
            if (month < account.startMonth) {
                return;
            }

            if (!account.started) {
                account.balance = account.amount || 0;
                account.cumulativeContributions = account.amount || 0;
                account.started = true;
            }

            const pastEnd = account.endMonth != null && month > account.endMonth;
            if (!pastEnd) {
                const monthlyRate = (account.rate || 0) / 100 / 12;
                const interest = account.balance * monthlyRate;
                const contribution = account.monthlyContribution || 0;
                account.balance = account.balance * (1 + monthlyRate) + contribution;
                account.cumulativeInterest += interest;
                account.cumulativeContributions += contribution;
            }

            if (account.includeInTotal !== false) {
                totalBalance += account.balance;
            }
        });

        return { totalBalance };
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
                loan.cumulativeInterestPaid += monthlyInterest;
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
                        text: `${(loan.name && String(loan.name).trim()) || 'Loan'} Paid Off!`
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
    
    createDataPoint(month, baseDate, savings, netWorth, loanBalance, totalContributions, interestEarned, totalInterestPaid, hasOverride) {
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
            totalContributions,
            interestEarned,
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

    /**
     * Amortize a single loan from its start through asOfDate's calendar month.
     * Future-start loans return the original amount. Must match calculateLoanPayments math.
     */
    remainingBalanceAsOf(loan, asOfDate = new Date(), baseDate = null) {
        if (!loan || !Number.isFinite(loan.amount)) return 0;

        // Parse YYYY-MM as local calendar months — `new Date('YYYY-MM-01')` is UTC and
        // shifts the month westward of UTC.
        let startMonthDate;
        if (loan.startDate && /^\d{4}-\d{2}$/.test(loan.startDate)) {
            const [y, m] = loan.startDate.split('-').map(Number);
            startMonthDate = new Date(y, m - 1, 1);
        } else if (baseDate) {
            startMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
            startMonthDate.setMonth(startMonthDate.getMonth() + (loan.startMonth || 1) - 1);
        } else {
            return loan.amount;
        }

        if (Number.isNaN(startMonthDate.getTime())) return loan.amount;

        const asOf = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
        const startMonth = startMonthDate;
        if (asOf < startMonth) return loan.amount;

        const monthsElapsed =
            (asOf.getFullYear() - startMonth.getFullYear()) * 12 +
            (asOf.getMonth() - startMonth.getMonth()) + 1;

        let balance = loan.amount;
        const payment = loan.monthlyPayment;
        const rate = loan.rate || 0;

        for (let i = 0; i < monthsElapsed; i++) {
            if (balance <= 0) return 0;
            const monthlyInterest = balance * (rate / 100 / 12);
            const monthlyPrincipal = Math.min(payment - monthlyInterest, balance);
            balance -= monthlyPrincipal;
            if (balance < 0) balance = 0;
        }

        return balance;
    }

    /**
     * Project a single savings account balance through asOfDate's calendar month.
     * After endDate/endMonth the balance freezes (must match calculateSavingsBalances).
     */
    savingsBalanceAsOf(account, asOfDate = new Date(), baseDate = null) {
        if (!account || !Number.isFinite(account.amount)) return 0;

        let startMonthDate;
        if (account.startDate && /^\d{4}-\d{2}$/.test(account.startDate)) {
            const [y, m] = account.startDate.split('-').map(Number);
            startMonthDate = new Date(y, m - 1, 1);
        } else if (baseDate) {
            startMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
            startMonthDate.setMonth(startMonthDate.getMonth() + (account.startMonth || 1) - 1);
        } else {
            return account.amount;
        }

        if (Number.isNaN(startMonthDate.getTime())) return account.amount;

        const asOf = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
        if (asOf < startMonthDate) return account.amount;

        let endMonthIndex = null;
        if (account.endDate && /^\d{4}-\d{2}$/.test(account.endDate)) {
            const [y, m] = account.endDate.split('-').map(Number);
            const endDate = new Date(y, m - 1, 1);
            endMonthIndex =
                (endDate.getFullYear() - startMonthDate.getFullYear()) * 12 +
                (endDate.getMonth() - startMonthDate.getMonth()) + 1;
        } else if (account.endMonth != null && baseDate) {
            endMonthIndex = account.endMonth - (account.startMonth || 1) + 1;
        }

        const monthsElapsed =
            (asOf.getFullYear() - startMonthDate.getFullYear()) * 12 +
            (asOf.getMonth() - startMonthDate.getMonth()) + 1;

        let balance = account.amount;
        const monthlyRate = (account.rate || 0) / 100 / 12;
        const contribution = account.monthlyContribution || 0;
        const growthMonths = endMonthIndex != null
            ? Math.min(monthsElapsed, endMonthIndex)
            : monthsElapsed;

        for (let i = 0; i < growthMonths; i++) {
            balance = balance * (1 + monthlyRate) + contribution;
        }

        return balance;
    }
}
