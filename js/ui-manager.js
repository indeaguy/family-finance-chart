/**
 * Form collection/validation, loans/savings lists (ruled-row grids), add modals,
 * account cards (loan/savings sheets; view or edit), JSON download.
 * Defines globals: UIManager
 * Depends on: LOAN_FIELDS, SAVINGS_FIELDS + field-model helpers (renderFormFields, renderTable,
 *   renderDetailRows, filterFields, readFormValue, formFieldDomId); DOM #addLoanFormFields, #loansList,
 *   #addLoanModal, #accountCardsRoot, #accountCardTemplate, #accountCardAnchor,
 *   #addSavingsFormFields, #savingsList, #addSavingsModal, projection fields for
 *   loadDataToForm (#startDate, #timePeriod, #goalAmount); formatCurrency is a method
 *   here (separate from format.js globals used by the summary overlay)
 *
 * Domain: "account card" = floating sheet for one loan or savings account
 * (#accountCardsRoot / #accountCardTemplate / .account-card / openAccountCard).
 * View mode is detail rows; Edit swaps in form fields and reveals Remove (confirm before delete).
 * Position: aligned to #accountCardAnchor (drawer .control-group left of the folder).
 */

/** Stagger step for each additional account card (px). */
const ACCOUNT_CARD_STAGGER_X = 28;
const ACCOUNT_CARD_STAGGER_Y = 36;
/** Max stagger slots before wrapping offsets so account cards stay on-screen. */
const ACCOUNT_CARD_STAGGER_WRAP = 6;

class UIManager {
    constructor() {
        this.currentChartData = [];
        this.loanFormBuilt = false;
        this.savingsFormBuilt = false;
        /** @type {Map<string, { el: HTMLElement, kind: string, entityId: number, staggerIndex: number, editing: boolean }>} open account cards */
        this.openAccountCards = new Map();
        this.accountCardFrontZ = 1100;
        this._accountCardAnchorBound = false;
    }

    accountCardFormIdPrefix(cardKey) {
        return `ac-${String(cardKey).replace(/[^a-zA-Z0-9-]/g, '-')}-`;
    }

    /** Keep open cards pinned to #accountCardAnchor while that slot is on-screen. */
    ensureAccountCardAnchorTracking() {
        if (this._accountCardAnchorBound) return;
        this._accountCardAnchorBound = true;
        window.addEventListener('resize', () => this.syncAccountCardAnchorPosition());
    }

    /**
     * Place account cards over the drawer control-group left of the folder.
     * When the anchor is off-screen (drawer closed), keep left alignment and
     * park near the bottom-left so cards stay reachable.
     */
    syncAccountCardAnchorPosition() {
        if (this.openAccountCards.size === 0) return;

        const anchor = document.getElementById('accountCardAnchor');
        let left = 36;
        let top = Math.max(72, window.innerHeight - 420);

        if (anchor) {
            const rect = anchor.getBoundingClientRect();
            left = Math.max(12, Math.round(rect.left));
            // Anchor is usable when its top is within the viewport (drawer open).
            if (rect.top >= 0 && rect.top < window.innerHeight - 40) {
                top = Math.round(rect.top);
            }
        }

        for (const entry of this.openAccountCards.values()) {
            entry.el.style.setProperty('--account-card-left', `${left}px`);
            entry.el.style.setProperty('--account-card-top', `${top}px`);
        }
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
    /** @param {{ idPrefix?: string, skipEnsure?: boolean }} [options] */
    getLoanFormData(options = {}) {
        const idPrefix = options.idPrefix || '';
        if (!idPrefix && !options.skipEnsure) this.ensureLoanFormFields();

        const amountField = LOAN_FIELDS.find(f => f.key === 'amount');
        const nameField = LOAN_FIELDS.find(f => f.key === 'name');
        const rateField = LOAN_FIELDS.find(f => f.key === 'rate');
        const termField = LOAN_FIELDS.find(f => f.key === 'term');
        const startField = LOAN_FIELDS.find(f => f.key === 'startDate');
        const paymentField = LOAN_FIELDS.find(f => f.key === 'monthlyPayment');

        const el = (field) => document.getElementById(formFieldDomId(field, idPrefix));
        const amount = readFormValue(amountField, el(amountField)) || 0;
        const name = readFormValue(nameField, el(nameField));
        const rate = readFormValue(rateField, el(rateField)) || 0;
        const term = readFormValue(termField, el(termField)) || 1;
        const startDate = readFormValue(startField, el(startField));
        const customPayment = readFormValue(paymentField, el(paymentField)) || 0;
        
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
                `tabindex="0" onclick="showLoanAccountCard(${loan.id})" ` +
                `onmouseenter="highlightChartLoan(${loan.id})" ` +
                `onmouseleave="clearChartListHover(${loan.id}, 'loan')" ` +
                `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showLoanAccountCard(${loan.id});}"`
        });
    }

    /** @param {{ idPrefix?: string, skipEnsure?: boolean }} [options] */
    getSavingsFormData(options = {}) {
        const idPrefix = options.idPrefix || '';
        if (!idPrefix && !options.skipEnsure) this.ensureSavingsFormFields();

        const amountField = SAVINGS_FIELDS.find(f => f.key === 'amount');
        const nameField = SAVINGS_FIELDS.find(f => f.key === 'name');
        const monthlyField = SAVINGS_FIELDS.find(f => f.key === 'monthlyContribution');
        const rateField = SAVINGS_FIELDS.find(f => f.key === 'rate');
        const startField = SAVINGS_FIELDS.find(f => f.key === 'startDate');
        const endField = SAVINGS_FIELDS.find(f => f.key === 'endDate');
        const includeField = SAVINGS_FIELDS.find(f => f.key === 'includeInTotal');

        const el = (field) => document.getElementById(formFieldDomId(field, idPrefix));
        const amount = readFormValue(amountField, el(amountField)) || 0;
        const name = readFormValue(nameField, el(nameField));
        const monthlyContribution = readFormValue(monthlyField, el(monthlyField)) || 0;
        const rate = readFormValue(rateField, el(rateField)) || 0;
        const startDate = readFormValue(startField, el(startField));
        const endDate = readFormValue(endField, el(endField)) || '';
        const includeInTotal = readFormValue(includeField, el(includeField));

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
                `tabindex="0" onclick="showSavingsAccountCard(${account.id})" ` +
                `onmouseenter="highlightChartSavings(${account.id})" ` +
                `onmouseleave="clearChartListHover(${account.id}, 'savings')" ` +
                `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showSavingsAccountCard(${account.id});}"`
        });
    }

    accountCardKey(kind, entityId) {
        return `${kind}:${entityId}`;
    }

    applyAccountCardStagger() {
        let index = 0;
        for (const entry of this.openAccountCards.values()) {
            const slot = index % ACCOUNT_CARD_STAGGER_WRAP;
            entry.staggerIndex = slot;
            entry.el.style.setProperty('--account-card-offset-x', `${slot * ACCOUNT_CARD_STAGGER_X}px`);
            entry.el.style.setProperty('--account-card-offset-y', `${slot * ACCOUNT_CARD_STAGGER_Y}px`);
            index += 1;
        }
        this.syncAccountCardAnchorPosition();
    }

    bringAccountCardToFront(key) {
        const entry = this.openAccountCards.get(key);
        if (!entry) return;

        for (const card of this.openAccountCards.values()) {
            card.el.classList.remove('is-front');
        }

        this.accountCardFrontZ += 1;
        entry.el.classList.add('is-front');
        entry.el.style.setProperty('--account-card-z', String(this.accountCardFrontZ));
    }

    syncAccountCardChartFocus() {
        const loanIds = [];
        const savingsIds = [];
        for (const entry of this.openAccountCards.values()) {
            if (entry.kind === 'loan') loanIds.push(entry.entityId);
            else if (entry.kind === 'savings') savingsIds.push(entry.entityId);
        }
        if (window.app && window.app.chartManager) {
            window.app.chartManager.setAccountCardFocus({ loanIds, savingsIds });
        }
    }

    accountCardHeadingId(kind, cardKey) {
        const safe = cardKey.replace(/[^a-zA-Z0-9-]/g, '-');
        return kind === 'loan'
            ? `loanAccountCardHeading-${safe}`
            : `savingsAccountCardHeading-${safe}`;
    }

    getAccountCardEntity(kind, entityId) {
        if (!window.app || !window.app.dataManager) return null;
        return kind === 'loan'
            ? window.app.dataManager.getLoanById(entityId)
            : window.app.dataManager.getSavingsAccountById(entityId);
    }

    buildLoanAccountCardBodyHtml(loan, cardKey, { editing = false } = {}) {
        const headingId = this.accountCardHeadingId('loan', cardKey);

        if (editing) {
            return `
                <div class="sheet-ruled-row sheet-heading" id="${headingId}">${(loan.name && String(loan.name).trim()) || 'Edit loan'}</div>
                <div data-account-card-form></div>
                <div class="sheet-ruled-row loan-detail-actions">
                    <button type="button" class="sheet-inline-btn" onclick="saveAccountCard('${cardKey}')">Save</button>
                    <button type="button" class="sheet-inline-btn sheet-danger-btn account-card-remove-btn" onclick="confirmRemoveLoan(${loan.id})">Remove</button>
                    <button type="button" class="sheet-inline-btn" onclick="cancelEditAccountCard('${cardKey}')">Cancel</button>
                </div>
            `;
        }

        const ctx = this.getLoanFieldContext();
        ctx.surface = 'detail';

        const extra = loan.isCustomPayment && loan.monthlyPayment > loan.calculatedPayment
            ? `$${(loan.monthlyPayment - loan.calculatedPayment).toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`
            : '—';

        return `
            <div class="sheet-ruled-row sheet-heading" id="${headingId}">${(loan.name && String(loan.name).trim()) || 'Loan details'}</div>
            ${renderDetailRows(LOAN_FIELDS, loan, ctx)}
            <div class="sheet-ruled-row"><span class="detail-label">Extra / mo</span><span class="detail-value">${extra}</span></div>
            <div class="sheet-ruled-row loan-detail-actions">
                <button type="button" class="sheet-inline-btn" onclick="editAccountCard('${cardKey}')">Edit</button>
                <button type="button" class="sheet-inline-btn sheet-danger-btn account-card-remove-btn" onclick="confirmRemoveLoan(${loan.id})">Remove</button>
                <button type="button" class="sheet-inline-btn" onclick="closeAccountCard('${cardKey}')">Close</button>
            </div>
        `;
    }

    buildSavingsAccountCardBodyHtml(account, cardKey, { editing = false } = {}) {
        const headingId = this.accountCardHeadingId('savings', cardKey);

        if (editing) {
            return `
                <div class="sheet-ruled-row sheet-heading" id="${headingId}">${(account.name && String(account.name).trim()) || 'Edit savings'}</div>
                <div data-account-card-form></div>
                <div class="sheet-ruled-row loan-detail-actions">
                    <button type="button" class="sheet-inline-btn" onclick="saveAccountCard('${cardKey}')">Save</button>
                    <button type="button" class="sheet-inline-btn sheet-danger-btn account-card-remove-btn" onclick="confirmRemoveSavingsAccount(${account.id})">Remove</button>
                    <button type="button" class="sheet-inline-btn" onclick="cancelEditAccountCard('${cardKey}')">Cancel</button>
                </div>
            `;
        }

        const ctx = this.getSavingsFieldContext();
        ctx.surface = 'detail';

        return `
            <div class="sheet-ruled-row sheet-heading" id="${headingId}">${(account.name && String(account.name).trim()) || 'Savings details'}</div>
            ${renderDetailRows(SAVINGS_FIELDS, account, ctx)}
            <div class="sheet-ruled-row loan-detail-actions">
                <button type="button" class="sheet-inline-btn" onclick="editAccountCard('${cardKey}')">Edit</button>
                <button type="button" class="sheet-inline-btn sheet-danger-btn account-card-remove-btn" onclick="confirmRemoveSavingsAccount(${account.id})">Remove</button>
                <button type="button" class="sheet-inline-btn" onclick="closeAccountCard('${cardKey}')">Close</button>
            </div>
        `;
    }

    fillAccountCardForm(fields, entity, idPrefix) {
        filterFields(fields, 'form').forEach(field => {
            const el = document.getElementById(formFieldDomId(field, idPrefix));
            if (!el) return;

            if (field.type === 'boolean') {
                el.checked = entity[field.key] !== false;
                return;
            }

            let value = entity[field.key];
            if (field.key === 'monthlyPayment') {
                value = entity.isCustomPayment ? entity.monthlyPayment : '';
            }
            if (value === null || value === undefined) value = '';
            el.value = value;
        });
    }

    renderAccountCardBody(entry) {
        const key = this.accountCardKey(entry.kind, entry.entityId);
        const entity = this.getAccountCardEntity(entry.kind, entry.entityId);
        if (!entity) {
            this.closeAccountCard(key);
            return;
        }

        const body = entry.el.querySelector('.loose-leaf-sheet-body');
        const sheet = entry.el.querySelector('.loose-leaf-sheet');
        if (!body || !sheet) return;

        const headingId = this.accountCardHeadingId(entry.kind, key);
        body.innerHTML = entry.kind === 'loan'
            ? this.buildLoanAccountCardBodyHtml(entity, key, { editing: entry.editing })
            : this.buildSavingsAccountCardBodyHtml(entity, key, { editing: entry.editing });
        sheet.setAttribute('aria-labelledby', headingId);

        if (entry.editing) {
            const formHost = body.querySelector('[data-account-card-form]');
            const fields = entry.kind === 'loan' ? LOAN_FIELDS : SAVINGS_FIELDS;
            const idPrefix = this.accountCardFormIdPrefix(key);
            renderFormFields(formHost, fields, { idPrefix });
            this.fillAccountCardForm(fields, entity, idPrefix);
            if (entry.kind === 'loan') {
                this.updateLoanPaymentPlaceholder(idPrefix);
                ['loanAmount', 'loanRate', 'loanTerm'].forEach(domId => {
                    const input = document.getElementById(idPrefix + domId);
                    if (input) input.addEventListener('input', () => this.updateLoanPaymentPlaceholder(idPrefix));
                });
            }
        }

        entry.el.classList.toggle('is-editing', !!entry.editing);
    }

    editAccountCard(key) {
        const entry = this.openAccountCards.get(key);
        if (!entry || entry.editing) return;
        entry.editing = true;
        this.bringAccountCardToFront(key);
        this.renderAccountCardBody(entry);
    }

    cancelEditAccountCard(key) {
        const entry = this.openAccountCards.get(key);
        if (!entry || !entry.editing) return;
        entry.editing = false;
        this.renderAccountCardBody(entry);
    }

    /** Re-render an open card after save (exits edit) or external data change. */
    refreshAccountCard(key) {
        const entry = this.openAccountCards.get(key);
        if (!entry) return;
        entry.editing = false;
        this.renderAccountCardBody(entry);
    }

    /** Open an account card for one loan or savings account. */
    openAccountCard(kind, entity) {
        if (!entity || !entity.id) return;

        const key = this.accountCardKey(kind, entity.id);
        if (this.openAccountCards.has(key)) {
            this.bringAccountCardToFront(key);
            return;
        }

        const template = document.getElementById('accountCardTemplate');
        const root = document.getElementById('accountCardsRoot');
        if (!template || !root) return;

        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.entityKey = key;

        const sheet = card.querySelector('.loose-leaf-sheet');
        const body = card.querySelector('.loose-leaf-sheet-body');
        const closeBtn = card.querySelector('.loose-leaf-sheet-x');
        if (!sheet || !body || !closeBtn) return;

        closeBtn.addEventListener('click', () => closeAccountCard(key));
        card.addEventListener('mousedown', () => this.bringAccountCardToFront(key));

        root.appendChild(card);
        const staggerIndex = this.openAccountCards.size % ACCOUNT_CARD_STAGGER_WRAP;
        const entry = { el: card, kind, entityId: entity.id, staggerIndex, editing: false };
        this.openAccountCards.set(key, entry);
        this.renderAccountCardBody(entry);
        this.ensureAccountCardAnchorTracking();
        this.applyAccountCardStagger();
        this.bringAccountCardToFront(key);
        this.syncAccountCardChartFocus();
    }

    closeAccountCard(key) {
        const entry = this.openAccountCards.get(key);
        if (!entry) return;

        entry.el.remove();
        this.openAccountCards.delete(key);
        this.applyAccountCardStagger();
        this.syncAccountCardChartFocus();
    }

    closeAccountCardsForEntity(kind, entityId) {
        this.closeAccountCard(this.accountCardKey(kind, entityId));
    }

    closeAllAccountCards() {
        for (const key of [...this.openAccountCards.keys()]) {
            this.closeAccountCard(key);
        }
    }

    showSavingsAccountCard(account) {
        this.openAccountCard('savings', account);
    }

    closeSavingsAccountCard(accountId) {
        if (accountId != null) {
            this.closeAccountCardsForEntity('savings', accountId);
            return;
        }
        for (const [key, entry] of this.openAccountCards.entries()) {
            if (entry.kind === 'savings') this.closeAccountCard(key);
        }
    }

    showLoanAccountCard(loan) {
        this.openAccountCard('loan', loan);
    }

    closeLoanAccountCard(loanId) {
        if (loanId != null) {
            this.closeAccountCardsForEntity('loan', loanId);
            return;
        }
        for (const [key, entry] of this.openAccountCards.entries()) {
            if (entry.kind === 'loan') this.closeAccountCard(key);
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
    /** @param {string} [idPrefix] scoped prefix for account-card loan inputs */
    updateLoanPaymentPlaceholder(idPrefix = '') {
        if (!idPrefix) this.ensureLoanFormFields();

        const amount = parseFloat(document.getElementById(idPrefix + 'loanAmount')?.value) || 0;
        const rate = parseFloat(document.getElementById(idPrefix + 'loanRate')?.value) || 0;
        const term = parseInt(document.getElementById(idPrefix + 'loanTerm')?.value, 10) || 1;
        const paymentInput = document.getElementById(idPrefix + 'loanMonthlyPayment');
        
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
