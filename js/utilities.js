/**
 * Utilities Component
 * Contains utility functions and UI helpers
 */

// Utility function to format currency values
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// Chart update function
function updateChart() {
    if (window.app) {
        window.app.updateChart();
    }
}

// Summary overlay management
function toggleSummaryOverlay() {
    const overlay = document.getElementById('summaryOverlay');
    if (overlay.classList.contains('show')) {
        closeSummaryOverlay();
    } else {
        showSummaryOverlay();
    }
}

function showSummaryOverlay() {
    const overlay = document.getElementById('summaryOverlay');
    updateSummaryOverlay();
    overlay.classList.add('show');
}

function closeSummaryOverlay() {
    const overlay = document.getElementById('summaryOverlay');
    overlay.classList.remove('show');
}

function updateSummaryOverlay() {
    const container = document.getElementById('summaryOverlayContent');
    if (!container) return;
    
    // Get current values
    const initialAmount = parseFloat(document.getElementById('initialAmount').value) || 0;
    const monthlySavings = parseFloat(document.getElementById('monthlySavings').value) || 0;
    const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
    const timePeriod = parseInt(document.getElementById('timePeriod').value) || 1;
    const goalAmount = parseFloat(document.getElementById('goalAmount').value) || 0;
    
    // Calculate final values
    const monthlyRate = interestRate / 100 / 12;
    const totalMonths = timePeriod * 12;
    
    let finalSavings = initialAmount;
    if (monthlyRate > 0) {
        finalSavings = initialAmount * Math.pow(1 + monthlyRate, totalMonths) + 
                      monthlySavings * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);
    } else {
        finalSavings = initialAmount + (monthlySavings * totalMonths);
    }
    
    // Get loan data from app if available
    let totalLoanBalance = 0;
    if (window.app && window.app.dataManager) {
        const loans = window.app.dataManager.getLoans();
        loans.forEach(loan => {
            const loanMonths = Math.min(totalMonths - loan.startMonth + 1, loan.term * 12);
            if (loanMonths > 0) {
                const monthlyRate = loan.rate / 100 / 12;
                if (monthlyRate > 0) {
                    const remaining = loan.amount * Math.pow(1 + monthlyRate, loanMonths) - 
                                    loan.monthlyPayment * ((Math.pow(1 + monthlyRate, loanMonths) - 1) / monthlyRate);
                    totalLoanBalance += Math.max(0, remaining);
                } else {
                    totalLoanBalance += Math.max(0, loan.amount - (loan.monthlyPayment * loanMonths));
                }
            }
        });
    }
    
    const netWorth = finalSavings - totalLoanBalance;
    const totalContributions = initialAmount + (monthlySavings * totalMonths);
    const totalInterest = finalSavings - totalContributions;
    
    // Reset the title to default
    const titleElement = document.querySelector('.summary-overlay-title');
    if (titleElement) {
        titleElement.textContent = '📊 Financial Summary';
    }
    
    // Create summary cards
    container.innerHTML = `
        <div class="summary-overlay-card">
            <h4>Final Savings</h4>
            <div class="value">${formatCurrency(finalSavings)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Net Worth</h4>
            <div class="value">${formatCurrency(netWorth)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Total Interest</h4>
            <div class="value">${formatCurrency(totalInterest)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Loan Balance</h4>
            <div class="value">${formatCurrency(totalLoanBalance)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Monthly Savings</h4>
            <div class="value">${formatCurrency(monthlySavings)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Time Period</h4>
            <div class="value">${timePeriod} years</div>
        </div>
    `;
}

// Chart header management
function showChartHeaderModal() {
    const modal = document.getElementById('chartHeaderModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeChartHeaderModal() {
    const modal = document.getElementById('chartHeaderModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updateChartHeader() {
    const title = document.getElementById('chartTitle')?.value || 'Family Finance Growth';
    const subtitle = document.getElementById('chartSubtitle')?.value || 'Interactive financial projection';
    const background = document.getElementById('chartHeaderBg')?.value || 'gradient';
    const position = document.getElementById('chartHeaderPos')?.value || 'top-left';
    const visible = document.getElementById('chartHeaderVisible')?.value === 'true';
    
    const headerElement = document.querySelector('.chart-header');
    const titleElement = headerElement?.querySelector('h1');
    const subtitleElement = headerElement?.querySelector('p');
    
    if (headerElement) {
        headerElement.style.display = visible ? 'block' : 'none';
        
        // Apply background
        switch (background) {
            case 'gradient':
                headerElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                break;
            case 'solid':
                headerElement.style.background = '#2c3e50';
                break;
            case 'transparent':
                headerElement.style.background = 'rgba(0,0,0,0.1)';
                break;
        }
        
        // Apply position
        headerElement.className = `chart-header ${position}`;
    }
    
    if (titleElement) {
        titleElement.textContent = title;
    }
    
    if (subtitleElement) {
        subtitleElement.textContent = subtitle;
    }
}

// Drawer management
function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    
    if (drawer.classList.contains('open')) {
        closeDrawer();
    } else {
        openDrawer();
    }
}

function openDrawer() {
    const drawer = document.getElementById('drawer');
    drawer.classList.add('open');
}

function closeDrawer() {
    const drawer = document.getElementById('drawer');
    drawer.classList.remove('open');
}

// Chart hover functionality
function showChartHover(event, dataPoint) {
    if (!dataPoint) return;
    
    const overlay = document.getElementById('summaryOverlay');
    const container = document.getElementById('summaryOverlayContent');
    const titleElement = document.querySelector('.summary-overlay-title');
    
    if (!overlay || !container || !titleElement) return;
    
    // Update title with date
    const date = new Date(dataPoint.time * 1000);
    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    titleElement.textContent = `📊 ${dateStr} (${formatTimeDisplay(dataPoint.month)})`;
    
    // Update content with hover data
    container.innerHTML = `
        <div class="summary-overlay-card">
            <h4>Savings</h4>
            <div class="value">${formatCurrency(dataPoint.savings)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Net Worth</h4>
            <div class="value">${formatCurrency(dataPoint.netWorth)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Contributions</h4>
            <div class="value">${formatCurrency(dataPoint.totalContributions)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Interest Earned</h4>
            <div class="value">${formatCurrency(dataPoint.interestEarned)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Loan Balance</h4>
            <div class="value">${formatCurrency(dataPoint.loanBalance)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Interest Paid</h4>
            <div class="value">${formatCurrency(dataPoint.totalInterestPaid)}</div>
        </div>
    `;
    
    overlay.classList.add('show');
}

function formatTimeDisplay(months) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (years === 0) {
        return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    } else if (remainingMonths === 0) {
        return `${years} year${years !== 1 ? 's' : ''}`;
    } else {
        return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    }
}

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    const drawer = document.getElementById('drawer');
    const handle = document.querySelector('.drawer-handle');
    const netWorthModal = document.getElementById('netWorthOverridesModal');
    const chartHeaderModal = document.getElementById('chartHeaderModal');
    const summaryOverlay = document.getElementById('summaryOverlay');
    
    // Close drawer when clicking outside drawer and handle
    if (drawer && handle && !drawer.contains(e.target) && !handle.contains(e.target)) {
        closeDrawer();
    }
    
    // Close net worth modal when clicking outside
    if (netWorthModal && e.target === netWorthModal) {
        closeNetWorthOverrides();
    }
    
    // Close chart header modal when clicking outside
    if (chartHeaderModal && e.target === chartHeaderModal) {
        closeChartHeaderModal();
    }
    
    // Close summary overlay when clicking outside
    if (summaryOverlay && e.target === summaryOverlay) {
        closeSummaryOverlay();
    }
});
