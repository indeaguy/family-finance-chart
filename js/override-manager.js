/**
 * Savings + loan-balance override modal: CRUD, date conversion, list rendering.
 * Also owns per-account balance-override calendar modal (YYYY-MM → ending balance)
 * and historical balance file import (CSV / OFX / QFX / QIF → merge into balanceOverrides).
 * Defines globals: OverrideManager (HTML onclick wrappers live in app.js)
 * Depends on: DataManager and UIManager (injected); historical-import.js
 *   (parseHistoricalBalanceFile, HistoricalImportError);
 *   DOM: #netWorthOverridesModal, #netWorthOverridesList, #overrideDate,
 *   #overrideSavings, #overrideLoanBalance, #accountBalanceOverridesModal,
 *   #accountBalanceOverridesCalendar, #accountBalanceOverrideMonth,
 *   #accountBalanceOverrideAmount, #accountBalanceOverridesList,
 *   #accountBalanceOverridesTitle, #accountBalanceHistoryFileInput,
 *   #startDate, #timePeriod
 */

class OverrideManager {
    constructor() {
        this.dataManager = null; // Will be injected by app
        this.uiManager = null; // Will be injected by app
        /** @type {{ kind: string, entityId: number }|null} */
        this.accountOverrideTarget = null;
        this.accountOverrideYear = new Date().getFullYear();
        /** @type {string|null} selected YYYY-MM in the account calendar */
        this.accountOverrideSelectedMonth = null;
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

    // --- Per-account balance overrides (calendar modal) ---

    showAccountBalanceOverrides(kind, entityId) {
        const entity = this.dataManager.getEntityByKind(kind, entityId);
        if (!entity) return;

        this.accountOverrideTarget = { kind, entityId };
        const startKey = entity.startDate && /^\d{4}-\d{2}$/.test(entity.startDate)
            ? entity.startDate
            : (document.getElementById('startDate')?.value || '');
        if (startKey) {
            this.accountOverrideYear = parseInt(startKey.slice(0, 4), 10);
        } else {
            this.accountOverrideYear = new Date().getFullYear();
        }
        this.accountOverrideSelectedMonth = startKey || null;

        const modal = document.getElementById('accountBalanceOverridesModal');
        const title = document.getElementById('accountBalanceOverridesTitle');
        if (title) {
            const label = (entity.name && String(entity.name).trim()) || (kind === 'loan' ? 'Loan' : 'Savings');
            title.textContent = `Date Overrides — ${label}`;
        }
        if (modal) {
            modal.style.display = 'block';
        }
        this.renderAccountBalanceOverrides();
    }

    closeAccountBalanceOverrides() {
        const modal = document.getElementById('accountBalanceOverridesModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.accountOverrideTarget = null;
        this.accountOverrideSelectedMonth = null;
        if (window.app) {
            window.app.updateChart();
            if (this.uiManager) {
                // Refresh view-mode cards so Balance reflects overrides; leave edit forms alone.
                this.uiManager.openAccountCards.forEach((entry, key) => {
                    if (entry && !entry.editing) {
                        this.uiManager.refreshAccountCard(key);
                    }
                });
            }
        }
    }

    shiftAccountOverrideYear(delta) {
        this.accountOverrideYear += delta;
        this.renderAccountBalanceOverrides();
    }

    selectAccountOverrideMonth(yyyyMm) {
        if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return;
        this.accountOverrideSelectedMonth = yyyyMm;
        this.accountOverrideYear = parseInt(yyyyMm.slice(0, 4), 10);
        const monthInput = document.getElementById('accountBalanceOverrideMonth');
        if (monthInput) monthInput.value = yyyyMm;

        const amountInput = document.getElementById('accountBalanceOverrideAmount');
        if (amountInput && this.accountOverrideTarget) {
            const overrides = this.dataManager.getEntityBalanceOverrides(
                this.accountOverrideTarget.kind,
                this.accountOverrideTarget.entityId
            );
            amountInput.value = Object.prototype.hasOwnProperty.call(overrides, yyyyMm)
                ? overrides[yyyyMm]
                : '';
            amountInput.focus();
        }
        this.renderAccountBalanceOverrides();
    }

    addAccountBalanceOverrideFromForm() {
        if (!this.accountOverrideTarget) return;

        const monthInput = document.getElementById('accountBalanceOverrideMonth');
        const amountInput = document.getElementById('accountBalanceOverrideAmount');
        const yyyyMm = (monthInput && monthInput.value) || this.accountOverrideSelectedMonth;
        const amount = amountInput ? parseFloat(amountInput.value) : NaN;

        if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) {
            alert('Please select a month');
            return;
        }
        if (!Number.isFinite(amount) || amount < 0) {
            alert('Please enter a valid balance (0 or greater)');
            return;
        }

        this.dataManager.setEntityBalanceOverride(
            this.accountOverrideTarget.kind,
            this.accountOverrideTarget.entityId,
            yyyyMm,
            amount
        );
        this.accountOverrideSelectedMonth = yyyyMm;
        this.accountOverrideYear = parseInt(yyyyMm.slice(0, 4), 10);
        if (amountInput) amountInput.value = '';
        this.renderAccountBalanceOverrides();
        if (window.app) window.app.updateChart();
    }

    removeAccountBalanceOverride(yyyyMm) {
        if (!this.accountOverrideTarget) return;
        this.dataManager.removeEntityBalanceOverride(
            this.accountOverrideTarget.kind,
            this.accountOverrideTarget.entityId,
            yyyyMm
        );
        this.renderAccountBalanceOverrides();
        if (window.app) window.app.updateChart();
    }

    /**
     * Open the hidden file picker for historical balances.
     * @param {string} [kind]
     * @param {number} [entityId]
     */
    importAccountBalanceHistory(kind, entityId) {
        if (kind && entityId != null) {
            this.accountOverrideTarget = { kind, entityId: Number(entityId) };
        }
        if (!this.accountOverrideTarget) {
            alert('Open an account card (Edit) or Date overrides before importing history.');
            return;
        }
        const input = document.getElementById('accountBalanceHistoryFileInput');
        if (!input) {
            alert('Import control is missing from the page.');
            return;
        }
        input.value = '';
        input.click();
    }

    handleAccountBalanceHistoryFile(event) {
        const file = event && event.target && event.target.files && event.target.files[0];
        if (!file) return;
        if (!this.accountOverrideTarget) {
            alert('No account selected for import.');
            return;
        }
        const { kind, entityId } = this.accountOverrideTarget;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result || '');
                const result = parseHistoricalBalanceFile(file.name, text);
                const keys = Object.keys(result.monthly).sort();
                const range = keys.length === 1
                    ? keys[0]
                    : `${keys[0]} … ${keys[keys.length - 1]}`;
                const warnNote = result.warnings && result.warnings.length
                    ? `\n\nNotes:\n- ${result.warnings.slice(0, 5).join('\n- ')}`
                    : '';
                const ok = confirm(
                    `Import ${keys.length} monthly balance` +
                    `${keys.length === 1 ? '' : 's'} (${range}) from ${result.format.toUpperCase()}?\n` +
                    `Months in the file overwrite existing date overrides; other months stay.\n` +
                    `If history starts before the chart, the timeline rewinds to include it.` +
                    warnNote
                );
                if (!ok) return;

                this.dataManager.mergeEntityBalanceOverrides(kind, entityId, result.monthly);
                this.dataManager.ensureChartCoversMonths(kind, entityId, result.monthly);

                const modal = document.getElementById('accountBalanceOverridesModal');
                if (modal && modal.style.display === 'block') {
                    const firstKey = keys[0];
                    if (firstKey) {
                        this.accountOverrideYear = parseInt(firstKey.slice(0, 4), 10);
                        this.accountOverrideSelectedMonth = firstKey;
                    }
                    this.renderAccountBalanceOverrides();
                }
                if (window.app) {
                    window.app.updateChart();
                    if (this.uiManager) {
                        this.uiManager.openAccountCards.forEach((entry, key) => {
                            if (entry && !entry.editing &&
                                entry.kind === kind && entry.entityId === entityId) {
                                this.uiManager.refreshAccountCard(key);
                            }
                        });
                    }
                }
            } catch (err) {
                const message = (err && err.message) || 'Could not import historical balances.';
                alert(message);
            } finally {
                if (event && event.target) event.target.value = '';
            }
        };
        reader.onerror = () => {
            alert('Failed to read the selected file.');
            if (event && event.target) event.target.value = '';
        };
        reader.readAsText(file);
    }

    renderAccountBalanceOverrides() {
        if (!this.accountOverrideTarget) return;

        const { kind, entityId } = this.accountOverrideTarget;
        const overrides = this.dataManager.getEntityBalanceOverrides(kind, entityId);
        const yearLabel = document.getElementById('accountBalanceOverrideYearLabel');
        if (yearLabel) yearLabel.textContent = String(this.accountOverrideYear);

        const monthInput = document.getElementById('accountBalanceOverrideMonth');
        if (monthInput && this.accountOverrideSelectedMonth) {
            monthInput.value = this.accountOverrideSelectedMonth;
        }

        const calendar = document.getElementById('accountBalanceOverridesCalendar');
        if (calendar) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            calendar.innerHTML = monthNames.map((name, index) => {
                const yyyyMm = `${this.accountOverrideYear}-${String(index + 1).padStart(2, '0')}`;
                const hasOverride = Object.prototype.hasOwnProperty.call(overrides, yyyyMm);
                const selected = this.accountOverrideSelectedMonth === yyyyMm;
                const classes = [
                    'balance-override-month',
                    hasOverride ? 'has-override' : '',
                    selected ? 'is-selected' : ''
                ].filter(Boolean).join(' ');
                const amountLabel = hasOverride
                    ? `$${Number(overrides[yyyyMm]).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                    : '';
                return `
                    <button type="button" class="${classes}" onclick="selectAccountOverrideMonth('${yyyyMm}')">
                        <span class="balance-override-month-name">${name}</span>
                        ${amountLabel ? `<span class="balance-override-month-amount">${amountLabel}</span>` : ''}
                    </button>
                `;
            }).join('');
        }

        const list = document.getElementById('accountBalanceOverridesList');
        if (!list) return;

        const entries = Object.entries(overrides).sort((a, b) => a[0].localeCompare(b[0]));
        if (entries.length === 0) {
            list.innerHTML = '<p class="balance-override-empty">No month overrides set</p>';
            return;
        }

        list.innerHTML = entries.map(([yyyyMm, amount]) => {
            const [y, m] = yyyyMm.split('-').map(Number);
            const dateStr = new Date(y, m - 1, 1).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short'
            });
            return `
                <div class="override-row">
                    <div>${dateStr}</div>
                    <div class="override-details">
                        <div>Balance: $${Number(amount).toLocaleString()}</div>
                    </div>
                    <button class="remove-override" onclick="removeAccountBalanceOverride('${yyyyMm}')">Remove</button>
                </div>
            `;
        }).join('');
    }
}
