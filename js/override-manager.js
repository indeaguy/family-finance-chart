/**
 * Override Manager Component
 * Handles financial overrides functionality
 */

class OverrideManager {
    constructor() {
        this.dataManager = null; // Will be injected by app
        this.uiManager = null; // Will be injected by app
    }
    
    setDataManager(dataManager) {
        this.dataManager = dataManager;
    }
    
    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }
    
    show() {
        const modal = document.getElementById('netWorthOverridesModal');
        if (modal) {
            modal.style.display = 'block';
            this.updateOverridesList();
            this.setDefaultDate();
        }
    }
    
    close() {
        const modal = document.getElementById('netWorthOverridesModal');
        if (modal) {
            modal.style.display = 'none';
        }
        // Trigger chart update through app
        if (window.app) {
            window.app.updateChart();
        }
    }
    
    setDefaultDate() {
        const startDate = document.getElementById('startDate').value;
        const overrideDateInput = document.getElementById('overrideDate');
        
        if (overrideDateInput) {
            if (startDate) {
                overrideDateInput.value = startDate;
            } else {
                const now = new Date();
                const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
                overrideDateInput.value = currentMonth;
            }
        }
    }
    
    addFromForm() {
        const overrideDate = document.getElementById('overrideDate').value;
        const overrideSavings = parseFloat(document.getElementById('overrideSavings').value);
        const overrideLoanBalance = parseFloat(document.getElementById('overrideLoanBalance').value);
        
        // Validate inputs
        if (!overrideDate || isNaN(overrideSavings) || isNaN(overrideLoanBalance)) {
            alert('Please enter a date, savings amount, and loan balance (can be 0)');
            return;
        }
        
        // Convert date to month number
        const monthDiff = this.calculateMonthDifference(overrideDate);
        if (monthDiff === null) return;
        
        // Add override to data manager
        this.dataManager.addOverride(monthDiff, overrideSavings, overrideLoanBalance);
        
        // Update UI
        this.updateOverridesList();
        this.clearForm();
    }
    
    remove(month) {
        this.dataManager.removeOverride(month);
        this.updateOverridesList();
    }
    
    calculateMonthDifference(overrideDate) {
        const startDate = document.getElementById('startDate').value;
        const baseDate = startDate ? new Date(startDate + '-01') : new Date();
        const overrideDateObj = new Date(overrideDate + '-01');
        
        const monthDiff = (overrideDateObj.getFullYear() - baseDate.getFullYear()) * 12 + 
                         (overrideDateObj.getMonth() - baseDate.getMonth()) + 1;
        
        if (monthDiff < 1) {
            alert('Override date must be after the start date');
            return null;
        }
        
        const maxMonths = parseInt(document.getElementById('timePeriod').value) * 12;
        if (monthDiff > maxMonths) {
            alert(`Override date must be within the ${maxMonths} month time period`);
            return null;
        }
        
        return monthDiff;
    }
    
    updateOverridesList() {
        const container = document.getElementById('netWorthOverridesList');
        if (!container) return;
        
        const overrides = this.dataManager.getOverrides();
        const overrideEntries = Object.entries(overrides).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
        
        if (overrideEntries.length === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic; text-align: center;">No financial overrides set</p>';
            return;
        }
        
        const startDate = document.getElementById('startDate').value;
        const baseDate = startDate ? new Date(startDate + '-01') : new Date();
        
        container.innerHTML = overrideEntries.map(([month, override]) => {
            // Convert month number back to date for display
            const displayDate = new Date(baseDate);
            displayDate.setMonth(displayDate.getMonth() + parseInt(month) - 1);
            const dateStr = displayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            
            // Handle both new format (object) and old format (direct amount)
            const savings = typeof override === 'object' ? override.savings : override;
            const loanBalance = typeof override === 'object' ? override.loanBalance : 0;
            const netWorth = savings - loanBalance;
            
            return `
                <div class="override-row">
                    <div>${dateStr} (${this.formatTimeDisplay(parseInt(month))})</div>
                    <div class="override-details">
                        <div>Savings: $${parseFloat(savings).toLocaleString()}</div>
                        <div>Loans: $${parseFloat(loanBalance).toLocaleString()}</div>
                        <div class="net-worth">Net Worth: $${parseFloat(netWorth).toLocaleString()}</div>
                    </div>
                    <button class="remove-override" onclick="removeNetWorthOverride(${month})">Remove</button>
                </div>
            `;
        }).join('');
    }
    
    clearForm() {
        const savingsInput = document.getElementById('overrideSavings');
        const loanBalanceInput = document.getElementById('overrideLoanBalance');
        
        if (savingsInput) savingsInput.value = '';
        if (loanBalanceInput) loanBalanceInput.value = '';
    }
    
    formatTimeDisplay(months) {
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
}
