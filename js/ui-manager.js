/**
 * UI Manager Component
 * Handles all user interface operations
 */

class UIManager {
    constructor() {
        this.currentChartData = [];
    }
    
    // Form Data Management
    getLoanFormData() {
        const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
        const rate = parseFloat(document.getElementById('loanRate').value) || 0;
        const term = parseInt(document.getElementById('loanTerm').value) || 1;
        const startDate = document.getElementById('loanStartDate').value;
        const customPayment = parseFloat(document.getElementById('loanMonthlyPayment').value) || 0;
        
        if (amount <= 0) {
            alert('Please enter a valid loan amount');
            return null;
        }
        
        if (!startDate) {
            alert('Please select a start date for the loan');
            return null;
        }
        
        // Calculate start month
        const savingsStartDate = document.getElementById('startDate').value;
        const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
        const loanStartDateObj = new Date(startDate + '-01');
        
        const startMonth = (loanStartDateObj.getFullYear() - baseDate.getFullYear()) * 12 + 
                          (loanStartDateObj.getMonth() - baseDate.getMonth()) + 1;
        
        if (startMonth < 1) {
            alert('Loan start date must be after the savings start date');
            return null;
        }
        
        return {
            amount,
            rate,
            term,
            startDate,
            startMonth,
            customPayment,
            isCustomPayment: customPayment > 0
        };
    }
    
    clearLoanForm() {
        document.getElementById('loanAmount').value = '';
        document.getElementById('loanRate').value = '4.5';
        document.getElementById('loanTerm').value = '30';
        document.getElementById('loanStartDate').value = '';
        document.getElementById('loanMonthlyPayment').value = '';
    }
    
    loadDataToForm(data) {
        if (data.savings) {
            document.getElementById('startDate').value = data.savings.startDate || '';
            document.getElementById('initialAmount').value = data.savings.initialAmount || 0;
            document.getElementById('monthlySavings').value = data.savings.monthlySavings || 0;
            document.getElementById('interestRate').value = data.savings.interestRate || 0;
            document.getElementById('timePeriod').value = data.savings.timePeriod || 1;
            document.getElementById('goalAmount').value = data.savings.goalAmount || '';
        }
        
        if (data.chartHeader) {
            const titleEl = document.getElementById('chartTitle');
            const subtitleEl = document.getElementById('chartSubtitle');
            const bgEl = document.getElementById('chartHeaderBg');
            const posEl = document.getElementById('chartHeaderPos');
            const visibleEl = document.getElementById('chartHeaderVisible');
            
            if (titleEl) titleEl.value = data.chartHeader.title || 'Family Finance Growth';
            if (subtitleEl) subtitleEl.value = data.chartHeader.subtitle || 'Interactive financial projection';
            if (bgEl) bgEl.value = data.chartHeader.background || 'gradient';
            if (posEl) posEl.value = data.chartHeader.position || 'top-left';
            if (visibleEl) visibleEl.value = data.chartHeader.visible !== false ? 'true' : 'false';
        }
    }
    
    // Loans List Management
    updateLoansList(loans) {
        const loansList = document.getElementById('loansList');
        if (!loansList) return;
        
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
            
            // Display start date
            let startDateDisplay;
            if (loan.startDate) {
                const startDateObj = new Date(loan.startDate + '-01');
                startDateDisplay = startDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            } else {
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
    
    // Summary Display
    updateSummary(results) {
        this.currentChartData = results.data;
        
        const summaryCards = document.querySelectorAll('.summary-card');
        if (summaryCards.length === 0) return;
        
        const finalData = results.data[results.data.length - 1];
        if (!finalData) return;
        
        // Update summary cards
        this.updateSummaryCard('Final Savings', this.formatCurrency(results.finalSavings));
        this.updateSummaryCard('Net Worth', this.formatCurrency(results.finalNetWorth));
        this.updateSummaryCard('Total Interest Earned', this.formatCurrency(finalData.interestEarned));
        this.updateSummaryCard('Total Interest Paid', this.formatCurrency(results.totalInterestPaid));
    }
    
    updateSummaryCard(title, value) {
        const cards = document.querySelectorAll('.summary-card');
        cards.forEach(card => {
            const cardTitle = card.querySelector('h4');
            if (cardTitle && cardTitle.textContent.includes(title.split(' ')[0])) {
                const valueEl = card.querySelector('.value');
                if (valueEl) valueEl.textContent = value;
            }
        });
    }
    
    // Loan Payment Placeholder
    updateLoanPaymentPlaceholder() {
        const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
        const rate = parseFloat(document.getElementById('loanRate').value) || 0;
        const term = parseInt(document.getElementById('loanTerm').value) || 1;
        const paymentInput = document.getElementById('loanMonthlyPayment');
        
        if (!paymentInput) return;
        
        if (amount > 0 && rate >= 0 && term > 0) {
            const calculatedPayment = this.calculateMonthlyPayment(amount, rate, term);
            paymentInput.placeholder = `Min: $${calculatedPayment.toLocaleString('en-US', {maximumFractionDigits: 2})}`;
        } else {
            paymentInput.placeholder = 'Auto-calculated';
        }
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
    
    // File Operations
    downloadJSON(data) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `family-finance-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Exported data:', data);
    }
    
    // Utility Functions
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
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
