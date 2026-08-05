/**
 * Financial summary overlay (toggle button + card grid), chart hover updates,
 * and the chart header customization modal.
 * Defines globals: toggleSummaryOverlay, showSummaryOverlay, closeSummaryOverlay,
 *   handleSummaryOverlayKeydown, updateSummaryOverlay, showChartHeaderModal,
 *   closeChartHeaderModal, updateChartHeader, showChartHover
 * Depends on: format.js (formatCurrency, formatTimeDisplay);
 *   window.app.calculator (preferred) or dataManager + #timePeriod for overlay totals;
 *   DOM: #summaryOverlay, #summaryOverlayContent, .summary-overlay-title,
 *   .summary-toggle, #chartHeaderModal, .chart-header, #timePeriod.
 * Note: prefers FinanceCalculator results so multi-account savings stay in sync.
 */

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
    const titleElement = document.querySelector('.summary-overlay-title');
    
    // Reset title to default when manually opening
    if (titleElement) {
        titleElement.textContent = '📊 Financial Summary';
    }
    
    updateSummaryOverlay();
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    
    // Add keyboard event listener for Escape key
    document.addEventListener('keydown', handleSummaryOverlayKeydown);
    
    // Focus the close button for accessibility
    const closeButton = overlay.querySelector('.summary-overlay-close');
    if (closeButton) {
        closeButton.focus();
    }
}

function closeSummaryOverlay() {
    const overlay = document.getElementById('summaryOverlay');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleSummaryOverlayKeydown);
    
    // Return focus to the toggle button
    const toggleButton = document.querySelector('.summary-toggle');
    if (toggleButton) {
        toggleButton.focus();
    }
}

function handleSummaryOverlayKeydown(event) {
    if (event.key === 'Escape') {
        closeSummaryOverlay();
    }
}

// Initialize summary toggle keyboard support
document.addEventListener('DOMContentLoaded', function() {
    const summaryToggle = document.querySelector('.summary-toggle');
    if (summaryToggle) {
        summaryToggle.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleSummaryOverlay();
            }
        });
    }
});

function updateSummaryOverlay() {
    const container = document.getElementById('summaryOverlayContent');
    if (!container) return;

    const timePeriod = parseInt(document.getElementById('timePeriod')?.value, 10) || 1;
    let finalSavings = 0;
    let netWorth = 0;
    let totalInterest = 0;
    let totalLoanBalance = 0;
    let monthlySavings = 0;

    if (window.app && window.app.calculator) {
        const results = window.app.calculator.calculateFinancialGrowth();
        finalSavings = results.finalSavings || 0;
        netWorth = results.finalNetWorth || 0;
        totalLoanBalance = Math.max(0, finalSavings - netWorth);
        const last = results.data && results.data[results.data.length - 1];
        totalInterest = last ? last.interestEarned : 0;
        if (window.app.dataManager) {
            monthlySavings = window.app.dataManager.getSavingsAccounts().reduce(
                (sum, account) => sum + (account.monthlyContribution || 0),
                0
            );
        }
    }
    
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

// Chart hover functionality
function showChartHover(event, dataPoint) {
    if (!dataPoint) return;
    
    const overlay = document.getElementById('summaryOverlay');
    const container = document.getElementById('summaryOverlayContent');
    const titleElement = document.querySelector('.summary-overlay-title');
    
    if (!overlay || !container || !titleElement) return;
    
    // Only update content if overlay is already visible (user has opened it)
    if (!overlay.classList.contains('show')) return;
    
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
    
    // Don't automatically show the overlay - let user control it with toggle button
}
