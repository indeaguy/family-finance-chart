/**
 * Form collection/validation, loans list (ruled-row grid), loan detail/add-loan modals, JSON download.
 * Defines globals: UIManager
 * Depends on: LOAN_FIELDS + field-model helpers (renderFormFields, renderTable, renderDetailRows,
 *   filterFields, readFormValue); DOM #addLoanFormFields, #loansList, #addLoanModal,
 *   #loanDetailModal, #loanDetailBody, savings form fields for loadDataToForm;
 *   formatCurrency is a method here (separate from format.js globals used by the summary overlay)
 */

class UIManager {
    constructor() {
        this.currentChartData = [];
        this.loanFormBuilt = false;
    }

    ensureLoanFormFields() {
        const container = document.getElementById('addLoanFormFields');
        if (!container || this.loanFormBuilt) return;
        renderFormFields(container, LOAN_FIELDS);
        this.loanFormBuilt = true;
    }

    getLoanFieldContext() {
        if (window.app && window.app.dataManager) {
            return { ...window.app.dataManager.getLoanFieldContext(), surface: 'table' };
        }
        const savingsStartDate = document.getElementById('startDate')?.value;
        const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
        return { baseDate, asOfDate: new Date(), surface: 'table' };
    }
    
    // Form Data Management
    getLoanFormData() {
        this.ensureLoanFormFields();

        const amountField = LOAN_FIELDS.find(f => f.key === 'amount');
        const rateField = LOAN_FIELDS.find(f => f.key === 'rate');
        const termField = LOAN_FIELDS.find(f => f.key === 'term');
        const startField = LOAN_FIELDS.find(f => f.key === 'startDate');
        const paymentField = LOAN_FIELDS.find(f => f.key === 'monthlyPayment');

        const amount = readFormValue(amountField, document.getElementById(amountField.domId)) || 0;
        const rate = readFormValue(rateField, document.getElementById(rateField.domId)) || 0;
        const term = readFormValue(termField, document.getElementById(termField.domId)) || 1;
        const startDate = readFormValue(startField, document.getElementById(startField.domId));
        const customPayment = readFormValue(paymentField, document.getElementById(paymentField.domId)) || 0;
        
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
        this.ensureLoanFormFields();

        filterFields(LOAN_FIELDS, 'form').forEach(field => {
            const el = document.getElementById(field.domId || field.key);
            if (!el) return;
            if (field.key === 'startDate') return;
            const def = field.default !== undefined && field.default !== null ? field.default : '';
            el.value = def;
        });

        const startDate = document.getElementById('loanStartDate');
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
        this.ensureLoanFormFields();
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

    // Loans list — one .sheet-ruled-row per line (div grid, not <table>;
    // table rows ignore max-height and drift off the paper rules)
    updateLoansList(loans) {
        const loansList = document.getElementById('loansList');
        if (!loansList) return;

        const ctx = this.getLoanFieldContext();
        ctx.surface = 'table';

        renderTable(loansList, loans, LOAN_FIELDS, {
            ariaLabel: 'Active loans',
            rowClass: 'loan-table-row',
            emptyMessage: 'No loans yet…',
            ctx,
            getRowAttrs: (loan) =>
                `tabindex="0" onclick="showLoanDetail(${loan.id})" ` +
                `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showLoanDetail(${loan.id});}"`
        });
    }

    showLoanDetailModal(loan) {
        const modal = document.getElementById('loanDetailModal');
        const body = document.getElementById('loanDetailBody');
        if (!modal || !body || !loan) return;

        const ctx = this.getLoanFieldContext();
        ctx.surface = 'detail';

        const extra = loan.isCustomPayment && loan.monthlyPayment > loan.calculatedPayment
            ? `$${(loan.monthlyPayment - loan.calculatedPayment).toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`
            : '—';

        body.innerHTML = `
            <div class="sheet-ruled-row sheet-heading" id="loanDetailHeading">Loan details</div>
            ${renderDetailRows(LOAN_FIELDS, loan, ctx)}
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
        this.ensureLoanFormFields();

        const amount = parseFloat(document.getElementById('loanAmount')?.value) || 0;
        const rate = parseFloat(document.getElementById('loanRate')?.value) || 0;
        const term = parseInt(document.getElementById('loanTerm')?.value, 10) || 1;
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
