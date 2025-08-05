/**
 * Family Finance Chart - Main Application
 * Central controller that coordinates all components
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
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set default values
        this.setDefaultValues();
        
        // Initial chart update
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
        // Input change listeners with debouncing
        const inputs = ['initialAmount', 'monthlySavings', 'interestRate', 'timePeriod', 'goalAmount', 'startDate'];
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
        // Set current month as default start date
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        
        const startDateElement = document.getElementById('startDate');
        const loanStartDateElement = document.getElementById('loanStartDate');
        
        if (startDateElement && !startDateElement.value) {
            startDateElement.value = currentMonth;
        }
        
        if (loanStartDateElement && !loanStartDateElement.value) {
            loanStartDateElement.value = currentMonth;
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
    }
    
    removeLoan(loanId) {
        this.dataManager.removeLoan(loanId);
        this.uiManager.updateLoansList(this.dataManager.getLoans());
        this.updateChart();
    }
    
    clearAllLoans() {
        if (this.dataManager.getLoans().length === 0) return;
        
        if (confirm('Are you sure you want to remove all loans?')) {
            this.dataManager.clearAllLoans();
            this.uiManager.updateLoansList([]);
            this.updateChart();
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
                this.uiManager.updateLoansList(this.dataManager.getLoans());
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
