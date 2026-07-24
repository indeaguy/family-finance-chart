/**
 * Shared formatting helpers and the updateChart global shim.
 * Defines globals: formatCurrency, formatTimeDisplay, updateChart
 * Depends on: window.app (updateChart shim only)
 */

// Utility function to format currency values
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// Chart update function
function updateChart() {
    if (window.app) {
        window.app.updateChart();
    }
}

function formatTimeDisplay(months) {
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
