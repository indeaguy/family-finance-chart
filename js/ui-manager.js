/**
 * Form collection/validation, loans/savings lists (ruled-row grids), detail/add modals, JSON download.
 * Defines globals: UIManager
 * Depends on: LOAN_FIELDS, SAVINGS_FIELDS + field-model helpers (renderFormFields, renderTable,
 *   renderDetailRows, filterFields, readFormValue); DOM #addLoanFormFields, #loansList,
 *   #addLoanModal, #floatingDetailPanelsRoot, #floatingDetailPanelTemplate, #addSavingsFormFields,
 *   #savingsList, #addSavingsModal, projection fields for loadDataToForm (#startDate, #timePeriod,
 *   #goalAmount); formatCurrency is a method here (separate from format.js globals used by the
 *   summary overlay)
 */

/** Stagger step for each additional floating detail panel (px). */
const DETAIL_PANEL_STAGGER_X = 28;
const DETAIL_PANEL_STAGGER_Y = 36;
/** Max stagger slots before wrapping offsets so panels stay on-screen. */
const DETAIL_PANEL_STAGGER_WRAP = 6;

class UIManager {
    constructor() {
        this.currentChartData = [];
        this.loanFormBuilt = false;
        this.savingsFormBuilt = false;
        /** @type {Map<string, { el: HTMLElement, kind: string, entityId: number, staggerIndex: number }>} */
        this.openDetailPanels = new Map();
        this.detailPanelFrontZ = 1100;
    }

    ensureLoanFormFields() {
        const container = document.getElementById('addLoanFormFields');
        if (!container || this.loanFormBuilt) return;
        renderFormFields(container, LOAN_FIELDS);
        this.loanFormBuilt = true;
    }

    ensureSavingsFormFields() {
        const container = document.getElementById('addSavingsFormFields');
        if (!container || this.savingsFormBuilt) return;
        renderFormFields(container, SAVINGS_FIELDS);
        this.savingsFormBuilt = true;
    }

    getLoanFieldContext() {
        return this.getProjectionFieldContext('table');
    }

    getSavingsFieldContext() {
        return this.getProjectionFieldContext('table');
    }

    getProjectionFieldContext(surface = 'table') {
        if (window.app && window.app.dataManager) {
            return { ...window.app.dataManager.getProjectionFieldContext(), surface };
        }
        const savingsStartDate = document.getElementById('startDate')?.value;
        const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
        return { baseDate, asOfDate: new Date(), surface };
    }
    
    // Form Data Management
    getLoanFormData() {
        this.ensureLoanFormFields();

        const amountField = LOAN_FIELDS.find(f => f.key === 'amount');
        const nameField = LOAN_FIELDS.find(f => f.key === 'name');
        const rateField = LOAN_FIELDS.find(f => f.key === 'rate');
        const termField = LOAN_FIELDS.find(f => f.key === 'term');
        const startField = LOAN_FIELDS.find(f => f.key === 'startDate');
        const paymentField = LOAN_FIELDS.find(f => f.key === 'monthlyPayment');

        const amount = readFormValue(amountField, document.getElementById(amountField.domId)) || 0;
        const name = readFormValue(nameField, document.getElementById(nameField.domId));
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
            name: name && String(name).trim(),
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
            const startEl = document.getElementById('startDate');
            const timeEl = document.getElementById('timePeriod');
            const goalEl = document.getElementById('goalAmount');
            if (startEl && data.savings.startDate) startEl.value = data.savings.startDate;
            if (timeEl) timeEl.value = data.savings.timePeriod || 20;
            if (goalEl) goalEl.value = data.savings.goalAmount || '';
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
                `onmouseenter="highlightChartLoan(${loan.id})" ` +
                `onmouseleave="clearChartListHover(${loan.id}, 'loan')" ` +
                `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showLoanDetail(${loan.id});}"`
        });
    }

    getSavingsFormData() {
        this.ensureSavingsFormFields();

        const amountField = SAVINGS_FIELDS.find(f => f.key === 'amount');
        const nameField = SAVINGS_FIELDS.find(f => f.key === 'name');
        const monthlyField = SAVINGS_FIELDS.find(f => f.key === 'monthlyContribution');
        const rateField = SAVINGS_FIELDS.find(f => f.key === 'rate');
        const startField = SAVINGS_FIELDS.find(f => f.key === 'startDate');
        const endField = SAVINGS_FIELDS.find(f => f.key === 'endDate');
        const includeField = SAVINGS_FIELDS.find(f => f.key === 'includeInTotal');

        const amount = readFormValue(amountField, document.getElementById(amountField.domId)) || 0;
        const name = readFormValue(nameField, document.getElementById(nameField.domId));
        const monthlyContribution = readFormValue(monthlyField, document.getElementById(monthlyField.domId)) || 0;
        const rate = readFormValue(rateField, document.getElementById(rateField.domId)) || 0;
        const startDate = readFormValue(startField, document.getElementById(startField.domId));
        const endDate = readFormValue(endField, document.getElementById(endField.domId)) || '';
        const includeInTotal = readFormValue(includeField, document.getElementById(includeField.domId));

        if (amount < 0) {
            alert('Please enter a valid initial amount');
            return null;
        }

        if (!startDate) {
            alert('Please select a start date for the savings account');
            return null;
        }

        const savingsStartDate = document.getElementById('startDate').value;
        const baseDate = savingsStartDate ? new Date(savingsStartDate + '-01') : new Date();
        const startDateObj = new Date(startDate + '-01');

        const startMonth = (startDateObj.getFullYear() - baseDate.getFullYear()) * 12 +
                          (startDateObj.getMonth() - baseDate.getMonth()) + 1;

        if (startMonth < 1) {
            alert('Savings start date must be on or after the projection start date');
            return null;
        }

        let endMonth = null;
        if (endDate) {
            const endDateObj = new Date(endDate + '-01');
            endMonth = (endDateObj.getFullYear() - baseDate.getFullYear()) * 12 +
                       (endDateObj.getMonth() - baseDate.getMonth()) + 1;
            if (endMonth < startMonth) {
                alert('End date must be on or after the start date');
                return null;
            }
        }

        return {
            name: name && String(name).trim(),
            amount,
            monthlyContribution,
            rate,
            startDate,
            startMonth,
            endDate: endDate || '',
            endMonth,
            includeInTotal: includeInTotal !== false
        };
    }

    clearSavingsForm() {
        this.ensureSavingsFormFields();

        filterFields(SAVINGS_FIELDS, 'form').forEach(field => {
            const el = document.getElementById(field.domId || field.key);
            if (!el) return;
            if (field.key === 'startDate' || field.key === 'endDate') return;
            const def = field.default !== undefined && field.default !== null ? field.default : '';
            if (field.type === 'boolean') {
                el.checked = !!def;
                return;
            }
            el.value = def;
        });

        const startDate = document.getElementById('savingsStartDate');
        if (startDate) {
            const projectionStart = document.getElementById('startDate')?.value;
            if (projectionStart) {
                startDate.value = projectionStart;
            } else {
                const now = new Date();
                startDate.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            }
        }

        const endDate = document.getElementById('savingsEndDate');
        if (endDate) endDate.value = '';
    }

    showAddSavingsForm() {
        const modal = document.getElementById('addSavingsModal');
        if (!modal) return;
        this.ensureSavingsFormFields();
        this.clearSavingsForm();
        modal.classList.add('is-open');
        modal.style.display = 'flex';
    }

    closeAddSavingsForm() {
        const modal = document.getElementById('addSavingsModal');
        if (modal) {
            modal.classList.remove('is-open');
            modal.style.display = 'none';
        }
    }

    updateSavingsList(accounts) {
        const savingsList = document.getElementById('savingsList');
        if (!savingsList) return;

        const ctx = this.getSavingsFieldContext();
        ctx.surface = 'table';

        renderTable(savingsList, accounts, SAVINGS_FIELDS, {
            ariaLabel: 'Active savings',
            rowClass: 'loan-table-row',
            emptyMessage: 'No savings yet…',
            ctx,
            getRowAttrs: (account) =>
                `tabindex="0" onclick="showSavingsDetail(${account.id})" ` +
                `onmouseenter="highlightChartSavings(${account.id})" ` +
                `onmouseleave="clearChartListHover(${account.id}, 'savings')" ` +
                `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showSavingsDetail(${account.id});}"`
        });
    }

    detailPanelKey(kind, entityId) {
        return `${kind}:${entityId}`;
    }

    applyDetailPanelStagger() {
        let index = 0;
        for (const entry of this.openDetailPanels.values()) {
            const slot = index % DETAIL_PANEL_STAGGER_WRAP;
            entry.staggerIndex = slot;
            entry.el.style.setProperty('--panel-offset-x', `${slot * DETAIL_PANEL_STAGGER_X}px`);
            entry.el.style.setProperty('--panel-offset-y', `${slot * DETAIL_PANEL_STAGGER_Y}px`);
            index += 1;
        }
    }

    bringDetailPanelToFront(key) {
        const entry = this.openDetailPanels.get(key);
        if (!entry) return;

        for (const panel of this.openDetailPanels.values()) {
            panel.el.classList.remove('is-front');
        }

        this.detailPanelFrontZ += 1;
        entry.el.classList.add('is-front');
        entry.el.style.setProperty('--panel-z', String(this.detailPanelFrontZ));
    }

    syncDetailChartFocus() {
        const loanIds = [];
        const savingsIds = [];
        for (const entry of this.openDetailPanels.values()) {
            if (entry.kind === 'loan') loanIds.push(entry.entityId);
            else if (entry.kind === 'savings') savingsIds.push(entry.entityId);
        }
        if (window.app && window.app.chartManager) {
            window.app.chartManager.setDetailFocus({ loanIds, savingsIds });
        }
    }

    buildLoanDetailBodyHtml(loan, panelKey) {
        const ctx = this.getLoanFieldContext();
        ctx.surface = 'detail';

        const extra = loan.isCustomPayment && loan.monthlyPayment > loan.calculatedPayment
            ? `$${(loan.monthlyPayment - loan.calculatedPayment).toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`
            : '—';
        const headingId = `loanDetailHeading-${panelKey.replace(/[^a-zA-Z0-9-]/g, '-')}`;

        return `
            <div class="sheet-ruled-row sheet-heading" id="${headingId}">${(loan.name && String(loan.name).trim()) || 'Loan details'}</div>
            ${renderDetailRows(LOAN_FIELDS, loan, ctx)}
            <div class="sheet-ruled-row"><span class="detail-label">Extra / mo</span><span class="detail-value">${extra}</span></div>
            <div class="sheet-ruled-row loan-detail-actions">
                <button type="button" class="sheet-inline-btn sheet-danger-btn" onclick="removeLoan(${loan.id})">Remove loan</button>
                <button type="button" class="sheet-inline-btn" onclick="closeDetailPanel('${panelKey}')">Close</button>
            </div>
        `;
    }

    buildSavingsDetailBodyHtml(account, panelKey) {
        const ctx = this.getSavingsFieldContext();
        ctx.surface = 'detail';
        const headingId = `savingsDetailHeading-${panelKey.replace(/[^a-zA-Z0-9-]/g, '-')}`;

        return `
            <div class="sheet-ruled-row sheet-heading" id="${headingId}">${(account.name && String(account.name).trim()) || 'Savings details'}</div>
            ${renderDetailRows(SAVINGS_FIELDS, account, ctx)}
            <div class="sheet-ruled-row loan-detail-actions">
                <button type="button" class="sheet-inline-btn sheet-danger-btn" onclick="removeSavingsAccount(${account.id})">Remove savings</button>
                <button type="button" class="sheet-inline-btn" onclick="closeDetailPanel('${panelKey}')">Close</button>
            </div>
        `;
    }

    openDetailPanel(kind, entity) {
        if (!entity || !entity.id) return;

        const key = this.detailPanelKey(kind, entity.id);
        if (this.openDetailPanels.has(key)) {
            this.bringDetailPanelToFront(key);
            return;
        }

        const template = document.getElementById('floatingDetailPanelTemplate');
        const root = document.getElementById('floatingDetailPanelsRoot');
        if (!template || !root) return;

        const panel = template.content.firstElementChild.cloneNode(true);
        panel.dataset.entityKey = key;

        const sheet = panel.querySelector('.loose-leaf-sheet');
        const body = panel.querySelector('.loose-leaf-sheet-body');
        const closeBtn = panel.querySelector('.loose-leaf-sheet-x');
        if (!sheet || !body || !closeBtn) return;

        const headingId = kind === 'loan'
            ? `loanDetailHeading-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`
            : `savingsDetailHeading-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`;

        body.innerHTML = kind === 'loan'
            ? this.buildLoanDetailBodyHtml(entity, key)
            : this.buildSavingsDetailBodyHtml(entity, key);

        sheet.setAttribute('aria-labelledby', headingId);
        closeBtn.addEventListener('click', () => closeDetailPanel(key));
        panel.addEventListener('mousedown', () => this.bringDetailPanelToFront(key));

        root.appendChild(panel);
        const staggerIndex = this.openDetailPanels.size % DETAIL_PANEL_STAGGER_WRAP;
        this.openDetailPanels.set(key, { el: panel, kind, entityId: entity.id, staggerIndex });
        this.applyDetailPanelStagger();
        this.bringDetailPanelToFront(key);
        this.syncDetailChartFocus();
    }

    closeDetailPanel(key) {
        const entry = this.openDetailPanels.get(key);
        if (!entry) return;

        entry.el.remove();
        this.openDetailPanels.delete(key);
        this.applyDetailPanelStagger();
        this.syncDetailChartFocus();
    }

    closeDetailPanelsForEntity(kind, entityId) {
        this.closeDetailPanel(this.detailPanelKey(kind, entityId));
    }

    closeAllDetailPanels() {
        for (const key of [...this.openDetailPanels.keys()]) {
            this.closeDetailPanel(key);
        }
    }

    showSavingsDetailModal(account) {
        this.openDetailPanel('savings', account);
    }

    closeSavingsDetailModal(accountId) {
        if (accountId != null) {
            this.closeDetailPanelsForEntity('savings', accountId);
            return;
        }
        for (const [key, entry] of this.openDetailPanels.entries()) {
            if (entry.kind === 'savings') this.closeDetailPanel(key);
        }
    }

    showLoanDetailModal(loan) {
        this.openDetailPanel('loan', loan);
    }

    closeLoanDetailModal(loanId) {
        if (loanId != null) {
            this.closeDetailPanelsForEntity('loan', loanId);
            return;
        }
        for (const [key, entry] of this.openDetailPanels.entries()) {
            if (entry.kind === 'loan') this.closeDetailPanel(key);
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
