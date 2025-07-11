function showNetWorthOverrides() {
    document.getElementById('netWorthOverridesModal').style.display = 'block';
    updateNetWorthOverridesList();
    
    // Set default override date to current start date or current month
    const startDate = document.getElementById('startDate').value;
    if (startDate) {
        document.getElementById('overrideDate').value = startDate;
    } else {
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        document.getElementById('overrideDate').value = currentMonth;
    }
}

function closeNetWorthOverrides() {
    document.getElementById('netWorthOverridesModal').style.display = 'none';
    updateChart(); // Refresh chart when closing modal
}

function addNetWorthOverrideFromForm() {
    const overrideDate = document.getElementById('overrideDate').value;
    const overrideAmount = parseFloat(document.getElementById('overrideAmount').value);
    
    if (!overrideDate || !overrideAmount || isNaN(overrideAmount)) {
        alert('Please enter both a date and amount');
        return;
    }
    
    // Convert date to month number relative to start date
    const startDate = document.getElementById('startDate').value;
    const baseDate = startDate ? new Date(startDate + '-01') : new Date();
    const overrideDateObj = new Date(overrideDate + '-01');
    
    // Calculate month difference
    const monthDiff = (overrideDateObj.getFullYear() - baseDate.getFullYear()) * 12 + 
                     (overrideDateObj.getMonth() - baseDate.getMonth()) + 1;
    
    if (monthDiff < 1) {
        alert('Override date must be after the start date');
        return;
    }
    
    const maxMonths = parseInt(document.getElementById('timePeriod').value) * 12;
    if (monthDiff > maxMonths) {
        alert(`Override date must be within the ${maxMonths} month time period`);
        return;
    }
    
    netWorthOverrides[monthDiff] = overrideAmount;
    updateNetWorthOverridesList();
    
    // Clear form
    document.getElementById('overrideAmount').value = '';
}

function addNetWorthOverride() {
    // Legacy function - now just calls the form version
    addNetWorthOverrideFromForm();
}

function removeNetWorthOverride(month) {
    delete netWorthOverrides[month];
    updateNetWorthOverridesList();
}

function updateNetWorthOverridesList() {
    const container = document.getElementById('netWorthOverridesList');
    const overrideEntries = Object.entries(netWorthOverrides).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    
    if (overrideEntries.length === 0) {
        container.innerHTML = '<p style="color: #666; font-style: italic; text-align: center;">No net worth overrides set</p>';
        return;
    }
    
    const startDate = document.getElementById('startDate').value;
    const baseDate = startDate ? new Date(startDate + '-01') : new Date();
    
    container.innerHTML = overrideEntries.map(([month, amount]) => {
        // Convert month number back to date for display
        const displayDate = new Date(baseDate);
        displayDate.setMonth(displayDate.getMonth() + parseInt(month) - 1);
        const dateStr = displayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        
        return `
            <div class="override-row">
                <div>${dateStr} (${formatTimeDisplay(parseInt(month))})</div>
                <div>$${parseFloat(amount).toLocaleString()}</div>
                <button class="remove-override" onclick="removeNetWorthOverride(${month})">Remove</button>
            </div>
        `;
    }).join('');
}

// Helper function to format months into years and months
function formatTimeDisplay(months) {
    if (months < 12) {
        return `${months} month${months === 1 ? '' : 's'}`;
    }
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (remainingMonths === 0) {
        return `${years} year${years === 1 ? '' : 's'}`;
    }
    
    return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
}

// Global variables
let chart;
let loans = [];
let chartData = [];
let currentChartData = []; // Store current chart data for hover functionality
let netWorthOverrides = {}; // Store net worth overrides {month: amount}
let chartSeries = {
    savings: null,
    netWorth: null,
    loanBalance: null,
    goalLine: null,
    netWorthOriginal: null // For comparison line
};

// Initialize the chart when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set default start date to current month
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('startDate').value = currentMonth;
    document.getElementById('loanStartDate').value = currentMonth; // Default loan start date too
    
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
            height: chartContainer.clientHeight || 500,
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
                fixLeftEdge: false,
                fixRightEdge: false,
            },
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (chart && chartContainer) {
                chart.applyOptions({ 
                    width: chartContainer.clientWidth,
                    height: chartContainer.clientHeight 
                });
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
    const goalAmount = parseFloat(document.getElementById('goalAmount').value) || 0;
    const startDate = document.getElementById('startDate').value;
    
    const monthlyRate = annualRate / 100 / 12;
    const totalMonths = years * 12;
    
    const data = [];
    const netWorthData = [];
    const netWorthOriginalData = []; // For comparison line
    const savingsData = [];
    const loanBalanceData = [];
    
    let currentSavings = initialAmount;
    let totalLoanBalance = 0;
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;
    let goalReachedMonth = null;
    let hasOverrides = Object.keys(netWorthOverrides).length > 0;
    
    // Calculate loan payments for each active loan
    const loanPayments = loans.map(loan => ({
        ...loan,
        remainingBalance: loan.amount,
        startMonth: loan.startMonth || 1
    }));
    
    // Create base date from start date input
    const baseDate = startDate ? new Date(startDate + '-01') : new Date();
    
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
        
        // Calculate original net worth (without overrides)
        const netWorthOriginal = currentSavings - totalLoanBalance;
        
        // Apply net worth override if it exists for this month
        const netWorth = netWorthOverrides[month] !== undefined ? netWorthOverrides[month] : netWorthOriginal;
        
        // Create date for this month
        const date = new Date(baseDate);
        date.setMonth(date.getMonth() + month - 1);
        const timestamp = date.getTime() / 1000;
        
        // Store detailed data for hover functionality
        const monthData = {
            time: timestamp,
            month: month,
            savings: currentSavings,
            netWorth: netWorth,
            netWorthOriginal: netWorthOriginal,
            loanBalance: totalLoanBalance,
            totalContributions: initialAmount + (monthlySavings * month),
            interestEarned: currentSavings - (initialAmount + (monthlySavings * month)) + totalPrincipalPaid,
            totalInterestPaid: totalInterestPaid,
            netWorthOverride: netWorthOverrides[month]
        };
        
        data.push(monthData);
        savingsData.push({ time: timestamp, value: currentSavings });
        netWorthData.push({ time: timestamp, value: netWorth });
        netWorthOriginalData.push({ time: timestamp, value: netWorthOriginal });
        loanBalanceData.push({ time: timestamp, value: totalLoanBalance });
        
        // Check if goal is reached (using actual net worth for goal checking)
        if (goalAmount > 0 && netWorth >= goalAmount && !goalReachedMonth) {
            goalReachedMonth = month;
            // Stop the chart here if goal is reached
            break;
        }
    }
    
    return {
        data,
        savingsData,
        netWorthData,
        netWorthOriginalData,
        loanBalanceData,
        finalSavings: currentSavings,
        finalNetWorth: netWorthOverrides[goalReachedMonth || totalMonths] !== undefined ? 
            netWorthOverrides[goalReachedMonth || totalMonths] : 
            (currentSavings - totalLoanBalance),
        finalNetWorthOriginal: currentSavings - totalLoanBalance,
        totalLoanBalance,
        totalInterestPaid,
        totalPrincipalPaid,
        totalContributions: initialAmount + (monthlySavings * (goalReachedMonth || totalMonths)),
        goalAmount: goalAmount,
        goalReachedMonth: goalReachedMonth,
        actualMonths: goalReachedMonth || totalMonths,
        hasOverrides: hasOverrides
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
    Object.keys(chartSeries).forEach(key => {
        if (chartSeries[key]) {
            chart.removeSeries(chartSeries[key]);
            chartSeries[key] = null;
        }
    });
    
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
            title: 'Net Worth' + (results.hasOverrides ? ' (With Overrides)' : '')
        });
        chartSeries.netWorth.setData(results.netWorthData);
        
        // Add comparison line if there are overrides
        if (results.hasOverrides) {
            chartSeries.netWorthOriginal = chart.addLineSeries({
                color: '#2196f3',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                title: 'Original Net Worth (No Overrides)'
            });
            chartSeries.netWorthOriginal.setData(results.netWorthOriginalData);
        }
        
        // Add loan balance line (red) if there are loans
        if (loans.length > 0) {
            chartSeries.loanBalance = chart.addLineSeries({
                color: '#f44336',
                lineWidth: 2,
                title: 'Total Loan Balance'
            });
            chartSeries.loanBalance.setData(results.loanBalanceData);
        }
        
        // Add goal line if goal is set
        if (results.goalAmount > 0) {
            chartSeries.goalLine = chart.addLineSeries({
                color: '#ff9800',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                title: `Goal: $${results.goalAmount.toLocaleString()}`
            });
            
            // Create horizontal line data for the goal
            const goalLineData = results.savingsData.map(point => ({
                time: point.time,
                value: results.goalAmount
            }));
            chartSeries.goalLine.setData(goalLineData);
            
            // Add goal marker if goal is reached
            if (results.goalReachedMonth) {
                const goalPoint = results.data.find(d => d.month === results.goalReachedMonth);
                if (goalPoint) {
                    chartSeries.savings.setMarkers([{
                        time: goalPoint.time,
                        position: 'aboveBar',
                        color: '#ff9800',
                        shape: 'circle',
                        text: `🎯 Goal Reached! ${formatTimeDisplay(results.goalReachedMonth)}`
                    }]);
                }
            }
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
    const timeDisplay = formatTimeDisplay(dataPoint.month);
    
    summaryContainer.innerHTML = `
        <div class="summary-card">
            <h4>Savings (${timeDisplay})</h4>
            <div class="value">$${dataPoint.savings.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Net Worth (${timeDisplay})</h4>
            <div class="value">$${dataPoint.netWorth.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Contributions (${timeDisplay})</h4>
            <div class="value">$${dataPoint.totalContributions.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Interest Earned (${timeDisplay})</h4>
            <div class="value">$${dataPoint.interestEarned.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Loan Balance (${timeDisplay})</h4>
            <div class="value">$${dataPoint.loanBalance.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>Interest Paid (${timeDisplay})</h4>
            <div class="value">$${dataPoint.totalInterestPaid.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
    `;
}

function updateSummary(results) {
    const summaryContainer = document.getElementById('summary');
    
    // Create goal achievement card if goal is set
    const goalCard = results.goalAmount > 0 ? `
        <div class="summary-card" style="background: ${results.goalReachedMonth ? '#e8f5e8' : '#fff3cd'};">
            <h4>${results.goalReachedMonth ? '🎯 Goal Achieved' : '🎯 Goal Progress'}</h4>
            <div class="value">${results.goalReachedMonth ? formatTimeDisplay(results.goalReachedMonth) : `${Math.round((results.finalSavings / results.goalAmount) * 100)}%`}</div>
        </div>
    ` : '';
    
    summaryContainer.innerHTML = `
        ${goalCard}
        <div class="summary-card">
            <h4>${results.goalReachedMonth ? 'Savings at Goal' : 'Final Savings'}</h4>
            <div class="value">$${results.finalSavings.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
        </div>
        <div class="summary-card">
            <h4>${results.goalReachedMonth ? 'Net Worth at Goal' : 'Final Net Worth'}</h4>
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
    `;
}

function addLoan() {
    const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const rate = parseFloat(document.getElementById('loanRate').value) || 0;
    const term = parseInt(document.getElementById('loanTerm').value) || 1;
    const startDate = document.getElementById('loanStartDate').value;
    const customPayment = parseFloat(document.getElementById('loanMonthlyPayment').value) || 0;
    
    if (amount <= 0) {
        alert('Please enter a valid loan amount');
        return;
    }
    
    if (!startDate) {
        alert('Please select a start date for the loan');
        return;
    }
    
    // Convert start date to month number relative to savings start date
    const savingsStartDate = document.getElementById('startDate').value;
    const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
    const loanStartDateObj = new Date(startDate + '-01');
    
    // Calculate month difference
    const startMonth = (loanStartDateObj.getFullYear() - baseDate.getFullYear()) * 12 + 
                      (loanStartDateObj.getMonth() - baseDate.getMonth()) + 1;
    
    if (startMonth < 1) {
        alert('Loan start date must be after the savings start date');
        return;
    }
    
    const calculatedPayment = calculateMonthlyPayment(amount, rate, term);
    const monthlyPayment = customPayment > 0 ? customPayment : calculatedPayment;
    
    // Validate that custom payment is at least the minimum required
    if (customPayment > 0 && customPayment < calculatedPayment) {
        const proceed = confirm(
            `Warning: Your custom payment ($${customPayment.toLocaleString()}) is less than the minimum required payment ($${calculatedPayment.toLocaleString()}). ` +
            `This loan may never be fully paid off. Do you want to continue?`
        );
        if (!proceed) return;
    }
    
    const loan = {
        id: Date.now(),
        amount: amount,
        rate: rate,
        term: term,
        startMonth: startMonth,
        startDate: startDate, // Store the actual date for display
        monthlyPayment: monthlyPayment,
        calculatedPayment: calculatedPayment,
        isCustomPayment: customPayment > 0
    };
    
    loans.push(loan);
    updateLoansList();
    updateChart();
    
    // Clear form
    document.getElementById('loanAmount').value = '';
    document.getElementById('loanRate').value = '4.5';
    document.getElementById('loanTerm').value = '30';
    document.getElementById('loanStartDate').value = '';
    document.getElementById('loanMonthlyPayment').value = '';
}

function removeLoan(loanId) {
    loans = loans.filter(loan => loan.id !== loanId);
    updateLoansList();
    updateChart();
}

function updateLoansList() {
    const loansList = document.getElementById('loansList');
    
    if (loans.length === 0) {
        loansList.innerHTML = '<p style="color: #666; font-style: italic; font-size: 12px; margin: 0;">No loans added yet</p>';
        return;
    }
    
    const savingsStartDate = document.getElementById('startDate').value;
    const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
    
    loansList.innerHTML = loans.map(loan => {
        const paymentInfo = loan.isCustomPayment 
            ? `<strong>$${loan.monthlyPayment.toLocaleString('en-US', {maximumFractionDigits: 0})}</strong> (Custom)`
            : `$${loan.monthlyPayment.toLocaleString('en-US', {maximumFractionDigits: 0})} (Min)`;
        
        const extraPayment = loan.isCustomPayment && loan.monthlyPayment > loan.calculatedPayment
            ? `<br><small style="color: #28a745;">+$${(loan.monthlyPayment - loan.calculatedPayment).toLocaleString('en-US', {maximumFractionDigits: 0})}/mo extra</small>`
            : '';
        
        // Convert start month back to readable date
        let startDateDisplay;
        if (loan.startDate) {
            // Use stored date if available (new format)
            const startDateObj = new Date(loan.startDate + '-01');
            startDateDisplay = startDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        } else {
            // Calculate from month number (backward compatibility)
            const startDateObj = new Date(baseDate);
            startDateObj.setMonth(startDateObj.getMonth() + loan.startMonth - 1);
            startDateDisplay = startDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        }
        
        return `
            <div class="loan-item">
                <div><strong>$${loan.amount.toLocaleString()}</strong> @ ${loan.rate}% / ${loan.term}yr</div>
                <div style="margin: 3px 0;">Payment: ${paymentInfo}</div>
                <div style="margin: 3px 0;">Starts: ${startDateDisplay}</div>
                ${extraPayment}
                <button class="remove-loan" onclick="removeLoan(${loan.id})">Remove</button>
            </div>
        `;
    }).join('');
}

function exportToJSON() {
    const data = {
        savings: {
            startDate: document.getElementById('startDate').value,
            initialAmount: parseFloat(document.getElementById('initialAmount').value) || 0,
            monthlySavings: parseFloat(document.getElementById('monthlySavings').value) || 0,
            interestRate: parseFloat(document.getElementById('interestRate').value) || 0,
            timePeriod: parseInt(document.getElementById('timePeriod').value) || 1,
            goalAmount: parseFloat(document.getElementById('goalAmount').value) || 0,
            netWorthOverrides: netWorthOverrides
        },
        loans: loans.map(loan => ({
            amount: loan.amount,
            rate: loan.rate,
            term: loan.term,
            startMonth: loan.startMonth,
            startDate: loan.startDate, // Include the actual date
            monthlyPayment: loan.isCustomPayment ? loan.monthlyPayment : null,
            isCustomPayment: loan.isCustomPayment
        })),
        exportDate: new Date().toISOString(),
        version: "1.2"
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-finance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Exported data:', data);
}

function importFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            loadDataFromJSON(data);
        } catch (error) {
            alert('Error reading JSON file: ' + error.message);
            console.error('JSON import error:', error);
        }
    };
    reader.readAsText(file);
}

function loadDataFromJSON(data) {
    try {
        // Load savings data
        if (data.savings) {
            document.getElementById('startDate').value = data.savings.startDate || '';
            document.getElementById('initialAmount').value = data.savings.initialAmount || 0;
            document.getElementById('monthlySavings').value = data.savings.monthlySavings || 0;
            document.getElementById('interestRate').value = data.savings.interestRate || 0;
            document.getElementById('timePeriod').value = data.savings.timePeriod || 1;
            document.getElementById('goalAmount').value = data.savings.goalAmount || '';
            
            // Load net worth overrides (new format) or monthly overrides (backward compatibility)
            netWorthOverrides = data.savings.netWorthOverrides || data.savings.monthlyOverrides || {};
        }
        
        // Load loans data
        if (data.loans && Array.isArray(data.loans)) {
            const savingsStartDate = document.getElementById('startDate').value;
            const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
            
            loans = data.loans.map((loanData, index) => {
                const calculatedPayment = calculateMonthlyPayment(loanData.amount, loanData.rate, loanData.term);
                const monthlyPayment = loanData.isCustomPayment && loanData.monthlyPayment 
                    ? loanData.monthlyPayment 
                    : calculatedPayment;
                
                // Handle start date - use stored date if available, otherwise calculate from month
                let startDate = loanData.startDate;
                let startMonth = loanData.startMonth || 1;
                
                if (!startDate && startMonth) {
                    // Convert month number to date for backward compatibility
                    const startDateObj = new Date(baseDate);
                    startDateObj.setMonth(startDateObj.getMonth() + startMonth - 1);
                    startDate = startDateObj.getFullYear() + '-' + String(startDateObj.getMonth() + 1).padStart(2, '0');
                }
                
                return {
                    id: Date.now() + index, // Generate new unique IDs
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
        
        // Update UI
        updateLoansList();
        updateChart();
        
        console.log('Successfully imported data:', data);
        alert(`Successfully imported financial data${data.exportDate ? ' from ' + new Date(data.exportDate).toLocaleDateString() : ''}!`);
        
    } catch (error) {
        alert('Error loading data: ' + error.message);
        console.error('Data loading error:', error);
    }
}

function clearAllLoans() {
    if (loans.length === 0) return;
    
    if (confirm('Are you sure you want to remove all loans?')) {
        loans = [];
        updateLoansList();
        updateChart();
    }
}

// Auto-update chart when inputs change
document.addEventListener('input', function(e) {
    if (e.target.type === 'number' && ['initialAmount', 'monthlySavings', 'interestRate', 'timePeriod', 'goalAmount'].includes(e.target.id)) {
        setTimeout(updateChart, 300); // Debounce updates
    }
    
    if (e.target.type === 'month' && e.target.id === 'startDate') {
        setTimeout(updateChart, 300); // Debounce updates
    }
    
    // Update loan payment placeholder when loan details change
    if (['loanAmount', 'loanRate', 'loanTerm'].includes(e.target.id)) {
        updateLoanPaymentPlaceholder();
    }
});

function updateLoanPaymentPlaceholder() {
    const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const rate = parseFloat(document.getElementById('loanRate').value) || 0;
    const term = parseInt(document.getElementById('loanTerm').value) || 1;
    
    if (amount > 0 && rate >= 0 && term > 0) {
        const calculatedPayment = calculateMonthlyPayment(amount, rate, term);
        document.getElementById('loanMonthlyPayment').placeholder = `Min: $${calculatedPayment.toLocaleString('en-US', {maximumFractionDigits: 2})}`;
    } else {
        document.getElementById('loanMonthlyPayment').placeholder = 'Auto-calculated';
    }
}
