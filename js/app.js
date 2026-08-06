/**
 * Main orchestrator: wires components, owns chart lifecycle, exposes HTML onclick globals.
 * Defines globals: FinanceApp, app / window.app, addLoan, removeLoan, showLoanDetail,
 *   closeLoanDetail, showAddLoanForm, closeAddLoanForm, addSavingsAccount, removeSavingsAccount,
 *   showSavingsDetail, closeSavingsDetail, closeDetailPanel, showAddSavingsForm, closeAddSavingsForm,
 *   clearAllLoans, exportToJSON,
 *   importFromJSON, showNetWorthOverrides, closeNetWorthOverrides,
 *   addNetWorthOverrideFromForm, removeNetWorthOverride,
 *   highlightChartLoan, highlightChartSavings, clearChartListHover
 * Depends on: FinanceCalculator, ChartManager, DataManager, UIManager, OverrideManager;
 *   folder-sheet.js (resetFolderSheetRaise after loan/savings list changes);
 *   field-model via UIManager.ensureLoanFormFields / ensureSavingsFormFields;
 *   DOM: #chart, projection inputs, loan/savings form fields, #jsonFileInput
 */

class FinanceApp {
    constructor() {
        this.chart = null;
        
        // Check if all required classes are available
        if (typeof FinanceCalculator === 'undefined') {
            throw new Error('FinanceCalculator class not loaded');
        }
        if (typeof ChartManager === 'undefined') {
            throw new Error('ChartManager class not loaded');
        }
        if (typeof DataManager === 'undefined') {
            throw new Error('DataManager class not loaded');
        }
        if (typeof UIManager === 'undefined') {
            throw new Error('UIManager class not loaded');
        }
        if (typeof OverrideManager === 'undefined') {
            throw new Error('OverrideManager class not loaded');
        }
        
        this.calculator = new FinanceCalculator();
        this.chartManager = new ChartManager();
        this.dataManager = new DataManager();
        this.uiManager = new UIManager();
        this.overrideManager = new OverrideManager();
        
        // Wire up dependencies
        this.calculator.setDataManager(this.dataManager);
        this.dataManager.setCalculator(this.calculator);
        this.overrideManager.setDataManager(this.dataManager);
        this.overrideManager.setUIManager(this.uiManager);
        
        this.init();
    }
    
    init() {
        // Initialize chart
        this.initializeChart();

        // Build schema-driven forms before listeners/defaults touch field DOM ids
        this.uiManager.ensureLoanFormFields();
        this.uiManager.ensureSavingsFormFields();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set default values
        this.setDefaultValues();

        // Demo loans/savings from js/default_config/ unless the user already imported JSON
        this.dataManager.loadDefaultExampleIfNeeded();
        this.uiManager.updateLoansList(this.dataManager.getLoans());
        this.uiManager.updateSavingsList(this.dataManager.getSavingsAccounts());
        this.updateChart();
    }
    
    initializeChart() {
        const chartContainer = document.getElementById('chart');
        if (!chartContainer) {
            console.error('Chart container not found');
            return;
        }
        
        this.chart = this.chartManager.createChart(chartContainer);
    }
    
    setupEventListeners() {
        // Projection timeline inputs (hidden) — still refresh chart if changed via import
        const inputs = ['timePeriod', 'goalAmount', 'startDate'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', this.debounce(() => this.updateChart(), 300));
            }
        });
        
        // Loan form listeners
        const loanInputs = ['loanAmount', 'loanRate', 'loanTerm'];
        loanInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.updateLoanPaymentPlaceholder());
            }
        });
    }
    
    setDefaultValues() {
        // Set current month as default projection start date
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        
        const startDateElement = document.getElementById('startDate');
        const loanStartDateElement = document.getElementById('loanStartDate');
        const savingsStartDateElement = document.getElementById('savingsStartDate');
        
        if (startDateElement && !startDateElement.value) {
            startDateElement.value = currentMonth;
        }
        
        if (loanStartDateElement && !loanStartDateElement.value) {
            loanStartDateElement.value = currentMonth;
        }

        if (savingsStartDateElement && !savingsStartDateElement.value) {
            savingsStartDateElement.value = currentMonth;
        }
    }
    
    updateChart() {
        try {
            // Get calculation results
            const results = this.calculator.calculateFinancialGrowth();
            
            // Update chart with new data
            this.chartManager.updateChart(this.chart, results);
            
            // Update summary display
            this.uiManager.updateSummary(results);
            
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }
    
    addLoan() {
        const loanData = this.uiManager.getLoanFormData();
        if (!loanData) return;
        
        const loan = this.dataManager.createLoan(loanData);
        if (!loan) return; // User cancelled due to payment warning
        
        this.dataManager.addLoan(loan);
        
        this.uiManager.updateLoansList(this.dataManager.getLoans());
        this.updateChart();
        this.uiManager.clearLoanForm();
        this.uiManager.closeAddLoanForm();
        if (typeof resetFolderSheetRaise === 'function') {
            resetFolderSheetRaise();
        }
    }

    showAddLoanForm() {
        this.uiManager.showAddLoanForm();
    }

    closeAddLoanForm() {
        this.uiManager.closeAddLoanForm();
    }

    addSavingsAccount() {
        const accountData = this.uiManager.getSavingsFormData();
        if (!accountData) return;

        const account = this.dataManager.createSavingsAccount(accountData);
        this.dataManager.addSavingsAccount(account);

        this.uiManager.updateSavingsList(this.dataManager.getSavingsAccounts());
        this.updateChart();
        this.uiManager.clearSavingsForm();
        this.uiManager.closeAddSavingsForm();
        if (typeof resetFolderSheetRaise === 'function') {
            resetFolderSheetRaise();
        }
    }

    showAddSavingsForm() {
        this.uiManager.showAddSavingsForm();
    }

    closeAddSavingsForm() {
        this.uiManager.closeAddSavingsForm();
    }

    removeSavingsAccount(accountId) {
        this.dataManager.removeSavingsAccount(accountId);
        this.uiManager.updateSavingsList(this.dataManager.getSavingsAccounts());
        this.uiManager.closeSavingsDetailModal(accountId);
        this.updateChart();
        if (typeof resetFolderSheetRaise === 'function') {
            resetFolderSheetRaise();
        }
    }

    showSavingsDetail(accountId) {
        const account = this.dataManager.getSavingsAccountById(accountId);
        if (!account) return;
        this.uiManager.showSavingsDetailModal(account);
    }

    closeSavingsDetail(accountId) {
        this.uiManager.closeSavingsDetailModal(accountId);
    }
    
    removeLoan(loanId) {
        this.dataManager.removeLoan(loanId);
        this.uiManager.updateLoansList(this.dataManager.getLoans());
        this.uiManager.closeLoanDetailModal(loanId);
        this.updateChart();
        if (typeof resetFolderSheetRaise === 'function') {
            resetFolderSheetRaise();
        }
    }

    showLoanDetail(loanId) {
        const loan = this.dataManager.getLoanById(loanId);
        if (!loan) return;
        this.uiManager.showLoanDetailModal(loan);
    }

    closeLoanDetail(loanId) {
        this.uiManager.closeLoanDetailModal(loanId);
    }
    
    clearAllLoans() {
        if (this.dataManager.getLoans().length === 0) return;
        
        if (confirm('Are you sure you want to remove all loans?')) {
            this.dataManager.clearAllLoans();
            this.uiManager.updateLoansList([]);
            this.uiManager.closeLoanDetailModal();
            this.updateChart();
            if (typeof resetFolderSheetRaise === 'function') {
                resetFolderSheetRaise();
            }
        }
    }
    
    updateLoanPaymentPlaceholder() {
        this.uiManager.updateLoanPaymentPlaceholder();
    }
    
    exportToJSON() {
        const data = this.dataManager.exportData();
        this.uiManager.downloadJSON(data);
    }
    
    importFromJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.dataManager.importData(file)
            .then(data => {
                this.uiManager.loadDataToForm(data);
                this.uiManager.closeAllDetailPanels();
                this.uiManager.updateLoansList(this.dataManager.getLoans());
                this.uiManager.updateSavingsList(this.dataManager.getSavingsAccounts());
                this.updateChart();
            })
            .catch(error => {
                alert('Error importing file: ' + error.message);
                console.error('Import error:', error);
            });
    }
    
    // Utility function for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Global app instance
let app;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        app = new FinanceApp();
        
        // Make app globally available for override manager
        window.app = app;
        
        console.log('FinanceApp initialized successfully');
    } catch (error) {
        console.error('Failed to initialize FinanceApp:', error);
        alert('Failed to initialize the application. Please refresh the page.');
    }
});

// Global functions for HTML onclick handlers
function addLoan() { 
    if (app) app.addLoan(); 
}
function removeLoan(id) { 
    if (app) app.removeLoan(id); 
}
function showLoanDetail(id) {
    if (app) app.showLoanDetail(id);
}
function closeLoanDetail(id) {
    if (app) app.closeLoanDetail(id);
}
function closeDetailPanel(key) {
    if (app) app.uiManager.closeDetailPanel(key);
}
function showAddLoanForm() {
    if (app) app.showAddLoanForm();
}
function closeAddLoanForm() {
    if (app) app.closeAddLoanForm();
}
function addSavingsAccount() {
    if (app) app.addSavingsAccount();
}
function removeSavingsAccount(id) {
    if (app) app.removeSavingsAccount(id);
}
function showSavingsDetail(id) {
    if (app) app.showSavingsDetail(id);
}
function closeSavingsDetail(id) {
    if (app) app.closeSavingsDetail(id);
}
function showAddSavingsForm() {
    if (app) app.showAddSavingsForm();
}
function closeAddSavingsForm() {
    if (app) app.closeAddSavingsForm();
}
function clearAllLoans() { 
    if (app) app.clearAllLoans(); 
}
function exportToJSON() { 
    if (app) app.exportToJSON(); 
}
function importFromJSON(event) { 
    if (app) app.importFromJSON(event); 
}
function showNetWorthOverrides() { 
    if (app) app.overrideManager.show(); 
}
function closeNetWorthOverrides() { 
    if (app) app.overrideManager.close(); 
}
function addNetWorthOverrideFromForm() { 
    if (app) app.overrideManager.addFromForm(); 
}
function removeNetWorthOverride(month) { 
    if (app) app.overrideManager.remove(month); 
}
function highlightChartLoan(id) {
    if (app) app.chartManager.highlightLoanFromList(id);
}
function highlightChartSavings(id) {
    if (app) app.chartManager.highlightSavingsFromList(id);
}
function clearChartListHover(id, kind) {
    if (app) app.chartManager.clearListHoverHighlight(id, kind);
}
