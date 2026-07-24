/**
 * Form collection/validation, loans list table, loan detail/add-loan modals, JSON download.
 * Defines globals: UIManager
 * Depends on: DOM loan form fields, #loansList, #addLoanModal, #loanDetailModal,
 *   #loanDetailBody, savings form fields for loadDataToForm; formatCurrency is a method here
 *   (separate from format.js globals used by the summary overlay)
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
        const amount = document.getElementById('loanAmount');
        const rate = document.getElementById('loanRate');
        const term = document.getElementById('loanTerm');
        const startDate = document.getElementById('loanStartDate');
        const payment = document.getElementById('loanMonthlyPayment');

        if (amount) amount.value = '200000';
        if (rate) rate.value = '4.5';
        if (term) term.value = '30';
        if (payment) payment.value = '';

        if (startDate) {
            const savingsStart = document.getElementById('startDate')?.value;
            if (savingsStart) {
                startDate.value = savingsStart;
            } else {
                const now = new Date();
                startDate.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            }
        }
    }

    showAddLoanForm() {
        const modal = document.getElementById('addLoanModal');
        if (!modal) return;
        this.clearLoanForm();
        this.updateLoanPaymentPlaceholder();
        modal.classList.add('is-open');
        modal.style.display = 'flex';
    }

    closeAddLoanForm() {
        const modal = document.getElementById('addLoanModal');
        if (modal) {
            modal.classList.remove('is-open');
            modal.style.display = 'none';
        }
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
    
    formatLoanStartDisplay(loan) {
        const savingsStartDate = document.getElementById('startDate')?.value;
        const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();

        if (loan.startDate) {
            return new Date(loan.startDate + '-01').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short'
            });
        }

        const startDateObj = new Date(baseDate);
        startDateObj.setMonth(startDateObj.getMonth() + (loan.startMonth || 1) - 1);
        return startDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    }

    // Loans table — one ruled row per loan; click opens detail modal
    updateLoansList(loans) {
        const loansList = document.getElementById('loansList');
        if (!loansList) return;
        
        if (loans.length === 0) {
            loansList.innerHTML = '<div class="sheet-ruled-row loans-empty">No loans yet…</div>';
            return;
        }

        const rows = loans.map(loan => {
            const payment = `$${loan.monthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
            const startDisplay = this.formatLoanStartDisplay(loan);

            return `
                <tr class="sheet-ruled-row loan-table-row" tabindex="0" role="button"
                    onclick="showLoanDetail(${loan.id})"
                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showLoanDetail(${loan.id});}">
                    <td>$${loan.amount.toLocaleString()}</td>
                    <td>${loan.rate}%</td>
                    <td>${loan.term}yr</td>
                    <td>${payment}</td>
                    <td>${startDisplay}</td>
                </tr>
            `;
        }).join('');

        loansList.innerHTML = `
            <table class="loans-table">
                <thead>
                    <tr class="sheet-ruled-row">
                        <th>Amount</th>
                        <th>Rate</th>
                        <th>Term</th>
                        <th>Pay</th>
                        <th>Start</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    showLoanDetailModal(loan) {
        const modal = document.getElementById('loanDetailModal');
        const body = document.getElementById('loanDetailBody');
        if (!modal || !body || !loan) return;

        const paymentLabel = loan.isCustomPayment ? 'Custom payment' : 'Min payment';
        const startDisplay = this.formatLoanStartDisplay(loan);
        const extra = loan.isCustomPayment && loan.monthlyPayment > loan.calculatedPayment
            ? `$${(loan.monthlyPayment - loan.calculatedPayment).toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`
            : '—';

        body.innerHTML = `
            <div class="sheet-ruled-row sheet-heading" id="loanDetailHeading">Loan details</div>
            <div class="sheet-ruled-row"><span class="detail-label">Amount</span><span class="detail-value">$${loan.amount.toLocaleString()}</span></div>
            <div class="sheet-ruled-row"><span class="detail-label">Rate</span><span class="detail-value">${loan.rate}%</span></div>
            <div class="sheet-ruled-row"><span class="detail-label">Term</span><span class="detail-value">${loan.term} years</span></div>
            <div class="sheet-ruled-row"><span class="detail-label">Start</span><span class="detail-value">${startDisplay}</span></div>
            <div class="sheet-ruled-row"><span class="detail-label">${paymentLabel}</span><span class="detail-value">$${loan.monthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></div>
            <div class="sheet-ruled-row"><span class="detail-label">Calculated min</span><span class="detail-value">$${loan.calculatedPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></div>
            <div class="sheet-ruled-row"><span class="detail-label">Extra / mo</span><span class="detail-value">${extra}</span></div>
            <div class="sheet-ruled-row loan-detail-actions">
                <button type="button" class="sheet-inline-btn sheet-danger-btn" onclick="removeLoan(${loan.id})">Remove loan</button>
                <button type="button" class="sheet-inline-btn" onclick="closeLoanDetail()">Close</button>
            </div>
        `;

        modal.classList.add('is-open');
        modal.style.display = 'flex';
        modal.dataset.loanId = String(loan.id);
    }

    closeLoanDetailModal() {
        const modal = document.getElementById('loanDetailModal');
        if (modal) {
            modal.classList.remove('is-open');
            modal.style.display = 'none';
            delete modal.dataset.loanId;
        }
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
