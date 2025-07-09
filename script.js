// Global variables
let chart;
let loans = [];
let chartData = [];
let currentChartData = []; // Store current chart data for hover functionality
let chartSeries = {
    savings: null,
    netWorth: null,
    loanBalance: null
};

// Initialize the chart when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the DOM to be fully ready
    setTimeout(() => {
        initializeChart();
        updateChart();
    }, 100);
});

function initializeChart() {
    const chartContainer = document.getElementById('chart');
    
    // Make sure the container exists and has dimensions
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }
    
    try {
        chart = LightweightCharts.createChart(chartContainer, {
            width: chartContainer.clientWidth || 800,
            height: 500,
            layout: {
                background: { color: '#ffffff' },
                textColor: '#333',
            },
            grid: {
                vertLines: { color: '#f0f0f0' },
                horzLines: { color: '#f0f0f0' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#cccccc',
            },
            timeScale: {
                borderColor: '#cccccc',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (chart && chartContainer) {
                chart.applyOptions({ width: chartContainer.clientWidth });
            }
        });
        
        console.log('Chart initialized successfully');
        console.log('Chart object:', chart);
        console.log('Available methods:', Object.getOwnPropertyNames(chart));
        
    } catch (error) {
        console.error('Error initializing chart:', error);
    }
}

function calculateMonthlyPayment(principal, rate, term) {
    const monthlyRate = rate / 100 / 12;
    const numPayments = term * 12;
    
    if (monthlyRate === 0) {
        return principal / numPayments;
    }
    
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
           (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function calculateFinancialGrowth() {
    const initialAmount = parseFloat(document.getElementById('initialAmount').value) || 0;
    const monthlySavings = parseFloat(document.getElementById('monthlySavings').value) || 0;
    const annualRate = parseFloat(document.getElementById('interestRate').value) || 0;
    const years = parseInt(document.getElementById('timePeriod').value) || 1;
    
    const monthlyRate = annualRate / 100 / 12;
    const totalMonths = years * 12;
    
    const data = [];
    const netWorthData = [];
    const savingsData = [];
    const loanBalanceData = [];
    
    let currentSavings = initialAmount;
    let totalLoanBalance = 0;
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;
    
    // Calculate loan payments for each active loan
    const loanPayments = loans.map(loan => ({
        ...loan,
        monthlyPayment: calculateMonthlyPayment(loan.amount, loan.rate, loan.term),
        remainingBalance: loan.amount,
        startMonth: loan.startMonth || 1
    }));
    
    for (let month = 1; month <= totalMonths; month++) {
        // Add monthly savings with compound interest
        currentSavings = currentSavings * (1 + monthlyRate) + monthlySavings;
        
        // Calculate loan payments and balances
        let monthlyLoanPayment = 0;
        let currentTotalLoanBalance = 0;
        
        loanPayments.forEach(loan => {
            if (month >= loan.startMonth && loan.remainingBalance > 0) {
                const monthlyInterest = loan.remainingBalance * (loan.rate / 100 / 12);
                const monthlyPrincipal = Math.min(loan.monthlyPayment - monthlyInterest, loan.remainingBalance);
                
                // Calculate actual payment (could be less than full payment for final month)
                const actualPayment = monthlyInterest + monthlyPrincipal;
                
                loan.remainingBalance -= monthlyPrincipal;
                monthlyLoanPayment += actualPayment;
                totalInterestPaid += monthlyInterest;
                totalPrincipalPaid += monthlyPrincipal;
                
                // Ensure balance doesn't go negative
                if (loan.remainingBalance < 0) loan.remainingBalance = 0;
            }
            
            // Only add to total if balance is still positive
            if (loan.remainingBalance > 0) {
                currentTotalLoanBalance += loan.remainingBalance;
            }
        });
        
        totalLoanBalance = currentTotalLoanBalance;
        
        // Subtract loan payments from savings (if we have enough)
        if (currentSavings >= monthlyLoanPayment) {
            currentSavings -= monthlyLoanPayment;
        }
        
        const netWorth = currentSavings - totalLoanBalance;
        
        // Create date for this month
        const date = new Date();
        date.setMonth(date.getMonth() + month);
        const timestamp = date.getTime() / 1000;
        
        // Store detailed data for hover functionality
        const monthData = {
            time: timestamp,
            month: month,
            savings: currentSavings,
            netWorth: netWorth,
            loanBalance: totalLoanBalance,
            totalContributions: initialAmount + (monthlySavings * month),
            interestEarned: currentSavings - (initialAmount + (monthlySavings * month)) + totalPrincipalPaid,
            totalInterestPaid: totalInterestPaid
        };
        
        data.push(monthData);
        savingsData.push({ time: timestamp, value: currentSavings });
        netWorthData.push({ time: timestamp, value: netWorth });
        loanBalanceData.push({ time: timestamp, value: totalLoanBalance });
    }
    
    return {
        data,
        savingsData,
        netWorthData,
        loanBalanceData,
        finalSavings: currentSavings,
        finalNetWorth: currentSavings - totalLoanBalance,
        totalLoanBalance,
        totalInterestPaid,
        totalPrincipalPaid,
        totalContributions: initialAmount + (monthlySavings * totalMonths)
    };
}

function updateChart() {
    // Make sure chart is initialized
    if (!chart) {
        console.error('Chart not initialized');
        return;
    }
    
    console.log('Chart object type:', typeof chart);
    console.log('Chart methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(chart)));
    
    const results = calculateFinancialGrowth();
    
    // Store data for hover functionality
    currentChartData = results.data;
    
    // Remove existing series if they exist
    if (chartSeries.savings) {
        chart.removeSeries(chartSeries.savings);
        chartSeries.savings = null;
    }
    if (chartSeries.netWorth) {
        chart.removeSeries(chartSeries.netWorth);
        chartSeries.netWorth = null;
    }
    if (chartSeries.loanBalance) {
        chart.removeSeries(chartSeries.loanBalance);
        chartSeries.loanBalance = null;
    }
    
    try {
        // Test if the method exists
        if (typeof chart.addLineSeries !== 'function') {
            console.error('addLineSeries is not a function. Available methods:', Object.keys(chart));
            return;
        }
        
        // Add savings line (green)
        chartSeries.savings = chart.addLineSeries({
            color: '#26a69a',
            lineWidth: 3,
            title: 'Total Savings'
        });
        chartSeries.savings.setData(results.savingsData);
        
        // Add net worth line (blue)
        chartSeries.netWorth = chart.addLineSeries({
            color: '#2196f3',
            lineWidth: 3,
            title: 'Net Worth'
        });
        chartSeries.netWorth.setData(results.netWorthData);
        
        // Add loan balance line (red) if there are loans
        if (loans.length > 0) {
            chartSeries.loanBalance = chart.addLineSeries({
                color: '#f44336',
                lineWidth: 2,
                title: 'Total Loan Balance'
            });
            chartSeries.loanBalance.setData(results.loanBalanceData);
        }
        
        // Add crosshair move handler for hover functionality
        chart.subscribeCrosshairMove(function(param) {
            if (param.time) {
                updateSummaryForTime(param.time);
            } else {
                // Show final values when not hovering
                updateSummary(results);
            }
        });
        
        // Update summary with final values initially
        updateSummary(results);
        
        // Fit chart content
        chart.timeScale().fitContent();
        
    } catch (error) {
        console.error('Error updating chart:', error);
        console.error('Error details:', error.stack);
    }
}

function updateSummaryForTime(time) {
    // Find the data point closest to the hovered time
    const dataPoint = currentChartData.find(point => Math.abs(point.time - time) < 30 * 24 * 60 * 60); // Within 30 days
    
    if (!dataPoint) return;
    
    const summaryContainer = document.getElementById('summary');
    
    summaryContainer.innerHTML = `
        <div class="summary-card">
            <h4>Savings (Month ${dataPoint.month})</h4>
            <div class="value">$${dataPoint.savings.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Net Worth (Month ${dataPoint.month})</h4>
            <div class="value">$${dataPoint.netWorth.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Contributions (Month ${dataPoint.month})</h4>
            <div class="value">$${dataPoint.totalContributions.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Interest Earned (Month ${dataPoint.month})</h4>
            <div class="value">$${dataPoint.interestEarned.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Loan Balance (Month ${dataPoint.month})</h4>
            <div class="value">$${dataPoint.loanBalance.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Interest Paid (Month ${dataPoint.month})</h4>
            <div class="value">$${dataPoint.totalInterestPaid.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
    `;
}

function updateSummary(results) {
    const summaryContainer = document.getElementById('summary');
    
    summaryContainer.innerHTML = `
        <div class="summary-card">
            <h4>Final Savings</h4>
            <div class="value">$${results.finalSavings.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Final Net Worth</h4>
            <div class="value">$${results.finalNetWorth.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Total Contributions</h4>
            <div class="value">$${results.totalContributions.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Interest Earned</h4>
            <div class="value">$${(results.finalSavings - results.totalContributions + results.totalPrincipalPaid).toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Remaining Loan Balance</h4>
            <div class="value">$${results.totalLoanBalance.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Total Interest Paid</h4>
            <div class="value">$${results.totalInterestPaid.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
    `;
}

function addLoan() {
    const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const rate = parseFloat(document.getElementById('loanRate').value) || 0;
    const term = parseInt(document.getElementById('loanTerm').value) || 1;
    const startMonth = parseInt(document.getElementById('loanStartMonth').value) || 1;
    
    if (amount <= 0) {
        alert('Please enter a valid loan amount');
        return;
    }
    
    const loan = {
        id: Date.now(),
        amount: amount,
        rate: rate,
        term: term,
        startMonth: startMonth,
        monthlyPayment: calculateMonthlyPayment(amount, rate, term)
    };
    
    loans.push(loan);
    updateLoansList();
    updateChart();
    
    // Clear form
    document.getElementById('loanAmount').value = '';
    document.getElementById('loanRate').value = '4.5';
    document.getElementById('loanTerm').value = '30';
    document.getElementById('loanStartMonth').value = '1';
}

function removeLoan(loanId) {
    loans = loans.filter(loan => loan.id !== loanId);
    updateLoansList();
    updateChart();
}

function updateLoansList() {
    const loansList = document.getElementById('loansList');
    
    if (loans.length === 0) {
        loansList.innerHTML = '<p style="color: #666; font-style: italic;">No loans added yet</p>';
        return;
    }
    
    loansList.innerHTML = loans.map(loan => `
        <div class="loan-item">
            <strong>$${loan.amount.toLocaleString()}</strong> at ${loan.rate}% for ${loan.term} years
            <br>
            <small>Monthly Payment: $${loan.monthlyPayment.toLocaleString('en-US', {maximumFractionDigits: 2})} | Starts: Month ${loan.startMonth}</small>
            <button class="remove-loan" onclick="removeLoan(${loan.id})">Remove</button>
        </div>
    `).join('');
}

// Auto-update chart when inputs change
document.addEventListener('input', function(e) {
    if (e.target.type === 'number' && ['initialAmount', 'monthlySavings', 'interestRate', 'timePeriod'].includes(e.target.id)) {
        setTimeout(updateChart, 300); // Debounce updates
    }
});
