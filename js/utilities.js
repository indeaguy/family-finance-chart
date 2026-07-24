/**
 * Utilities Component
 * Contains utility functions and UI helpers
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

// Summary overlay management
function toggleSummaryOverlay() {
    const overlay = document.getElementById('summaryOverlay');
    if (overlay.classList.contains('show')) {
        closeSummaryOverlay();
    } else {
        showSummaryOverlay();
    }
}

function showSummaryOverlay() {
    const overlay = document.getElementById('summaryOverlay');
    const titleElement = document.querySelector('.summary-overlay-title');
    
    // Reset title to default when manually opening
    if (titleElement) {
        titleElement.textContent = '📊 Financial Summary';
    }
    
    updateSummaryOverlay();
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    
    // Add keyboard event listener for Escape key
    document.addEventListener('keydown', handleSummaryOverlayKeydown);
    
    // Focus the close button for accessibility
    const closeButton = overlay.querySelector('.summary-overlay-close');
    if (closeButton) {
        closeButton.focus();
    }
}

function closeSummaryOverlay() {
    const overlay = document.getElementById('summaryOverlay');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleSummaryOverlayKeydown);
    
    // Return focus to the toggle button
    const toggleButton = document.querySelector('.summary-toggle');
    if (toggleButton) {
        toggleButton.focus();
    }
}

function handleSummaryOverlayKeydown(event) {
    if (event.key === 'Escape') {
        closeSummaryOverlay();
    }
}

// Initialize summary toggle keyboard support
document.addEventListener('DOMContentLoaded', function() {
    const summaryToggle = document.querySelector('.summary-toggle');
    if (summaryToggle) {
        summaryToggle.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleSummaryOverlay();
            }
        });
    }
});

function updateSummaryOverlay() {
    const container = document.getElementById('summaryOverlayContent');
    if (!container) return;
    
    // Get current values
    const initialAmount = parseFloat(document.getElementById('initialAmount').value) || 0;
    const monthlySavings = parseFloat(document.getElementById('monthlySavings').value) || 0;
    const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
    const timePeriod = parseInt(document.getElementById('timePeriod').value) || 1;
    const goalAmount = parseFloat(document.getElementById('goalAmount').value) || 0;
    
    // Calculate final values
    const monthlyRate = interestRate / 100 / 12;
    const totalMonths = timePeriod * 12;
    
    let finalSavings = initialAmount;
    if (monthlyRate > 0) {
        finalSavings = initialAmount * Math.pow(1 + monthlyRate, totalMonths) + 
                      monthlySavings * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);
    } else {
        finalSavings = initialAmount + (monthlySavings * totalMonths);
    }
    
    // Get loan data from app if available
    let totalLoanBalance = 0;
    if (window.app && window.app.dataManager) {
        const loans = window.app.dataManager.getLoans();
        loans.forEach(loan => {
            const loanMonths = Math.min(totalMonths - loan.startMonth + 1, loan.term * 12);
            if (loanMonths > 0) {
                const monthlyRate = loan.rate / 100 / 12;
                if (monthlyRate > 0) {
                    const remaining = loan.amount * Math.pow(1 + monthlyRate, loanMonths) - 
                                    loan.monthlyPayment * ((Math.pow(1 + monthlyRate, loanMonths) - 1) / monthlyRate);
                    totalLoanBalance += Math.max(0, remaining);
                } else {
                    totalLoanBalance += Math.max(0, loan.amount - (loan.monthlyPayment * loanMonths));
                }
            }
        });
    }
    
    const netWorth = finalSavings - totalLoanBalance;
    const totalContributions = initialAmount + (monthlySavings * totalMonths);
    const totalInterest = finalSavings - totalContributions;
    
    // Reset the title to default
    const titleElement = document.querySelector('.summary-overlay-title');
    if (titleElement) {
        titleElement.textContent = '📊 Financial Summary';
    }
    
    // Create summary cards
    container.innerHTML = `
        <div class="summary-overlay-card">
            <h4>Final Savings</h4>
            <div class="value">${formatCurrency(finalSavings)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Net Worth</h4>
            <div class="value">${formatCurrency(netWorth)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Total Interest</h4>
            <div class="value">${formatCurrency(totalInterest)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Loan Balance</h4>
            <div class="value">${formatCurrency(totalLoanBalance)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Monthly Savings</h4>
            <div class="value">${formatCurrency(monthlySavings)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Time Period</h4>
            <div class="value">${timePeriod} years</div>
        </div>
    `;
}

// Chart header management
function showChartHeaderModal() {
    const modal = document.getElementById('chartHeaderModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeChartHeaderModal() {
    const modal = document.getElementById('chartHeaderModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updateChartHeader() {
    const title = document.getElementById('chartTitle')?.value || 'Family Finance Growth';
    const subtitle = document.getElementById('chartSubtitle')?.value || 'Interactive financial projection';
    const background = document.getElementById('chartHeaderBg')?.value || 'gradient';
    const position = document.getElementById('chartHeaderPos')?.value || 'top-left';
    const visible = document.getElementById('chartHeaderVisible')?.value === 'true';
    
    const headerElement = document.querySelector('.chart-header');
    const titleElement = headerElement?.querySelector('h1');
    const subtitleElement = headerElement?.querySelector('p');
    
    if (headerElement) {
        headerElement.style.display = visible ? 'block' : 'none';
        
        // Apply background
        switch (background) {
            case 'gradient':
                headerElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                break;
            case 'solid':
                headerElement.style.background = '#2c3e50';
                break;
            case 'transparent':
                headerElement.style.background = 'rgba(0,0,0,0.1)';
                break;
        }
        
        // Apply position
        headerElement.className = `chart-header ${position}`;
    }
    
    if (titleElement) {
        titleElement.textContent = title;
    }
    
    if (subtitleElement) {
        subtitleElement.textContent = subtitle;
    }
}

// Folder sheet tabs (Loans / Savings) — raise loose-leaf only to reveal clipped content
let folderSheetRaiseOffset = 0;
let folderSheetTouchY = null;
let pencilRollOffset = 0;
let pencilEntranceRaf = null;

function getActiveFolderSheet(folder) {
    return folder ? folder.querySelector('.folder-sheet.active') : null;
}

function getPencilFacetCycle(folder) {
    const raw = getComputedStyle(folder).getPropertyValue('--pencil-facet-cycle').trim();
    if (raw.endsWith('px')) {
        return parseFloat(raw) || 40;
    }
    // calc(var(--pencil-facet) * 10) may not resolve via getPropertyValue in all engines
    const facet = parseFloat(getComputedStyle(folder).getPropertyValue('--pencil-facet')) || 4;
    return facet * 10;
}

/**
 * Size the pocket to the drawer bottom using relative offsets (stable while closed).
 * Must not be called repeatedly during the open animation — that causes layout jerk.
 */
function updateFolderPocketHeight() {
    const drawer = document.getElementById('drawer');
    const folder = document.getElementById('loansSavingsFolder');
    const pocket = folder?.querySelector('.folder-pocket');
    const interior = drawer?.querySelector('.drawer-interior');
    if (!drawer || !folder || !pocket || !interior) return;

    const drawerHeight = drawer.getBoundingClientRect().height;
    const interiorRect = interior.getBoundingClientRect();
    const pocketRect = pocket.getBoundingClientRect();
    // Relative offset is stable even when the drawer is translated off-screen
    const offsetInDrawer = pocketRect.top - interiorRect.top;
    const body = folder.querySelector('.folder-body');
    const bodyPad = body ? parseFloat(getComputedStyle(body).paddingBottom) || 0 : 0;
    const line = parseFloat(getComputedStyle(folder).getPropertyValue('--leaf-line')) || 28;
    const raw = drawerHeight - offsetInDrawer - bodyPad;
    const snapped = Math.max(line * 6, Math.floor(raw / line) * line);
    folder.style.setProperty('--folder-pocket-height', `${snapped}px`);
}

/**
 * How far the sheet may rise: only the amount of content clipped by the pocket.
 * Example: pocket is 280px tall; after adding several loans the sheet is 420px —
 * max raise is 140px so the hidden loan rows can be brought into view. If
 * everything already fits (sheet ≤ pocket), max raise is 0 and wheel does nothing.
 */
function getMaxFolderSheetRaise(sheet) {
    if (!sheet) return 0;
    const pocket = sheet.closest('.folder-pocket');
    if (!pocket) return 0;

    const pocketHeight = pocket.clientHeight;
    const sheetHeight = sheet.scrollHeight;
    return Math.max(0, sheetHeight - pocketHeight);
}

function setPencilRollPosition(folder, offsetPx) {
    const roll = folder?.querySelector('.pencil-barrel-roll');
    if (!roll) return;
    const cycle = getPencilFacetCycle(folder);
    pencilRollOffset = ((offsetPx % cycle) + cycle) % cycle;
    roll.style.backgroundPosition = `0 ${-pencilRollOffset}px`;
}

function applyPencilRoll(folder, raiseDelta) {
    if (!folder || !raiseDelta) return;
    // 1:1 with paper travel so facet surface speed matches scroll speed
    setPencilRollPosition(folder, pencilRollOffset - raiseDelta);
}

function resetPencilBelowFold() {
    const footer = document.querySelector('.folder-pocket-footer');
    const drawer = document.getElementById('drawer');
    if (footer) {
        footer.classList.remove('pencil-above-fold', 'pencil-on-drawer-floor');
        footer.style.transition = 'none';
        footer.style.bottom = '';
    }
    if (drawer && !drawer.classList.contains('sheet-escaping')) {
        drawer.classList.remove('pencil-entering');
    }
    if (pencilEntranceRaf) {
        cancelAnimationFrame(pencilEntranceRaf);
        pencilEntranceRaf = null;
    }
}

/**
 * After the drawer finishes opening: roll the pencil up from below the
 * bottom of the screen into its rest position on the loose-leaf.
 * Bottom position and facet roll share one rAF so speeds stay matched (no-slip).
 */
function playPencilEntranceRoll() {
    const folder = document.getElementById('loansSavingsFolder');
    const footer = folder?.querySelector('.folder-pocket-footer');
    const drawer = document.getElementById('drawer');
    if (!folder || !footer || !drawer || folder.classList.contains('folder-savings')) return;

    resetPencilBelowFold();
    setPencilRollPosition(folder, 0);

    // Start fully below the screen edge; rest a little above the drawer floor
    const startBottom = -32;
    const endBottom = 14;
    const travelPx = endBottom - startBottom;

    drawer.classList.add('pencil-entering');
    footer.style.transition = 'none';
    footer.style.bottom = `${startBottom}px`;
    footer.classList.add('pencil-on-drawer-floor');
    void footer.offsetWidth;

    footer.classList.add('pencil-above-fold');

    // +travel matches open-drawer roll direction; 1:1 with lift distance
    const facetTravel = travelPx;
    const duration = 550;
    const start = performance.now();

    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 2);
        footer.style.bottom = `${startBottom + travelPx * eased}px`;
        setPencilRollPosition(folder, facetTravel * eased);
        if (t < 1) {
            pencilEntranceRaf = requestAnimationFrame(step);
        } else {
            footer.style.bottom = `${endBottom}px`;
            pencilEntranceRaf = null;
            if (!drawer.classList.contains('sheet-escaping')) {
                drawer.classList.remove('pencil-entering');
            }
        }
    };
    pencilEntranceRaf = requestAnimationFrame(step);
}

function applyFolderSheetRaise(folder, offset) {
    const sheet = getActiveFolderSheet(folder);
    const drawer = document.getElementById('drawer');
    if (!sheet || !folder) return;

    const maxRaise = getMaxFolderSheetRaise(sheet);
    const previous = folderSheetRaiseOffset;
    folderSheetRaiseOffset = Math.max(0, Math.min(maxRaise, offset));
    const raiseDelta = folderSheetRaiseOffset - previous;

    sheet.style.transform = folderSheetRaiseOffset
        ? `translateY(-${folderSheetRaiseOffset}px)`
        : '';

    if (raiseDelta !== 0) {
        applyPencilRoll(folder, raiseDelta);
    }

    const raised = folderSheetRaiseOffset > 0;
    folder.classList.toggle('sheet-raised', raised);
    if (drawer) {
        drawer.classList.toggle('sheet-escaping', raised);
    }
}

function resetFolderSheetRaise() {
    const folder = document.getElementById('loansSavingsFolder');
    folderSheetRaiseOffset = 0;
    folderSheetTouchY = null;
    if (!folder) return;

    folder.querySelectorAll('.folder-sheet').forEach((sheet) => {
        sheet.style.transform = '';
    });
    setPencilRollPosition(folder, 0);
    folder.classList.remove('sheet-raised');

    const drawer = document.getElementById('drawer');
    if (drawer) {
        drawer.classList.remove('sheet-escaping');
    }
}

function switchFolderSheet(sheetName) {
    const folder = document.getElementById('loansSavingsFolder');
    if (!folder) return;

    resetFolderSheetRaise();

    const sheets = folder.querySelectorAll('.folder-sheet');
    const tabs = folder.querySelectorAll('.folder-tab');

    sheets.forEach((sheet) => {
        const isActive = sheet.dataset.sheet === sheetName;
        sheet.classList.toggle('active', isActive);
        if (isActive) {
            sheet.removeAttribute('hidden');
        } else {
            sheet.setAttribute('hidden', '');
        }
    });

    tabs.forEach((tab) => {
        const isActive = tab.dataset.sheet === sheetName;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    folder.dataset.activeSheet = sheetName;
    folder.classList.toggle('folder-loans', sheetName === 'loans');
    folder.classList.toggle('folder-savings', sheetName === 'savings');

    if (sheetName === 'loans' && document.getElementById('drawer')?.classList.contains('open')) {
        const footer = folder.querySelector('.folder-pocket-footer');
        if (footer && !footer.classList.contains('pencil-above-fold')) {
            playPencilEntranceRoll();
        } else if (footer) {
            footer.classList.add('pencil-on-drawer-floor', 'pencil-above-fold');
        }
    }
}

function initFolderSheetRaise() {
    const folder = document.getElementById('loansSavingsFolder');
    if (!folder || folder.dataset.raiseBound === 'true') return;
    folder.dataset.raiseBound = 'true';

    // Stable height before any open animation
    updateFolderPocketHeight();

    // While the sheet can raise (or is raised), absorb wheel/touch here so the
    // drawer interior never scrolls in the same gesture.
    folder.addEventListener('wheel', (e) => {
        const sheet = getActiveFolderSheet(folder);
        if (!sheet) return;

        const maxRaise = getMaxFolderSheetRaise(sheet);
        if (maxRaise <= 0 && folderSheetRaiseOffset <= 0) return;

        e.preventDefault();
        e.stopPropagation();
        applyFolderSheetRaise(folder, folderSheetRaiseOffset + e.deltaY);
    }, { passive: false });

    folder.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            folderSheetTouchY = e.touches[0].clientY;
        }
    }, { passive: true });

    folder.addEventListener('touchmove', (e) => {
        const sheet = getActiveFolderSheet(folder);
        if (!sheet || folderSheetTouchY === null || e.touches.length !== 1) return;

        const maxRaise = getMaxFolderSheetRaise(sheet);
        if (maxRaise <= 0 && folderSheetRaiseOffset <= 0) return;

        const currentY = e.touches[0].clientY;
        const deltaY = folderSheetTouchY - currentY;
        folderSheetTouchY = currentY;

        e.preventDefault();
        applyFolderSheetRaise(folder, folderSheetRaiseOffset + deltaY);
    }, { passive: false });

    folder.addEventListener('touchend', () => {
        folderSheetTouchY = null;
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', initFolderSheetRaise);

// Drawer management
function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    
    if (drawer.classList.contains('open')) {
        closeDrawer();
    } else {
        openDrawer();
    }
}

function openDrawer() {
    const drawer = document.getElementById('drawer');
    const handle = document.querySelector('.drawer-handle');

    // Lock pocket height before the open animation so contents do not reflow mid-slide
    updateFolderPocketHeight();
    resetPencilBelowFold();
    
    if (handle) {
        // Get computed height (which includes min-height enforcement)
        const computedStyle = window.getComputedStyle(drawer);
        const height = computedStyle.height;
        
        // Convert vh units to pixels or use pixel value directly
        let drawerHeightPx;
        if (height.includes('vh')) {
            const vhValue = parseFloat(height);
            drawerHeightPx = (vhValue / 100) * window.innerHeight;
        } else {
            drawerHeightPx = parseFloat(height);
        }
        
        // Ensure minimum height of 374px (should already be enforced by CSS)
        const finalHeight = Math.max(drawerHeightPx, 374);
        
        // Set both at exactly the same time
        handle.style.bottom = `${finalHeight - 2}px`;
        drawer.classList.add('open');
    } else {
        drawer.classList.add('open');
    }

    let pencilEntranceStarted = false;
    const startPencilEntrance = () => {
        if (pencilEntranceStarted || !drawer.classList.contains('open')) return;
        pencilEntranceStarted = true;
        drawer.removeEventListener('transitionend', onDrawerOpened);
        playPencilEntranceRoll();
    };
    const onDrawerOpened = (e) => {
        if (e.target !== drawer || e.propertyName !== 'transform') return;
        startPencilEntrance();
    };
    drawer.addEventListener('transitionend', onDrawerOpened);
    // Fallback if transitionend does not fire
    setTimeout(startPencilEntrance, 450);
}

function closeDrawer() {
    const drawer = document.getElementById('drawer');
    const handle = document.querySelector('.drawer-handle');
    
    // Set both at exactly the same time
    if (handle) {
        handle.style.bottom = '-10px';
    }
    drawer.classList.remove('open');
    resetPencilBelowFold();
    resetFolderSheetRaise();
}

// Handle window resize to reposition handle if drawer is open
window.addEventListener('resize', () => {
    const drawer = document.getElementById('drawer');
    if (drawer && drawer.classList.contains('open')) {
        const handle = document.querySelector('.drawer-handle');
        if (handle) {
            const computedStyle = window.getComputedStyle(drawer);
            const height = computedStyle.height;
            
            let drawerHeightPx;
            if (height.includes('vh')) {
                const vhValue = parseFloat(height);
                drawerHeightPx = (vhValue / 100) * window.innerHeight;
            } else {
                drawerHeightPx = parseFloat(height);
            }
            
            // Ensure minimum height of 374px
            const finalHeight = Math.max(drawerHeightPx, 374);
            handle.style.bottom = `${finalHeight - 2}px`;
        }
        updateFolderPocketHeight();
    }
});

// Chart hover functionality
function showChartHover(event, dataPoint) {
    if (!dataPoint) return;
    
    const overlay = document.getElementById('summaryOverlay');
    const container = document.getElementById('summaryOverlayContent');
    const titleElement = document.querySelector('.summary-overlay-title');
    
    if (!overlay || !container || !titleElement) return;
    
    // Only update content if overlay is already visible (user has opened it)
    if (!overlay.classList.contains('show')) return;
    
    // Update title with date
    const date = new Date(dataPoint.time * 1000);
    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    titleElement.textContent = `📊 ${dateStr} (${formatTimeDisplay(dataPoint.month)})`;
    
    // Update content with hover data
    container.innerHTML = `
        <div class="summary-overlay-card">
            <h4>Savings</h4>
            <div class="value">${formatCurrency(dataPoint.savings)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Net Worth</h4>
            <div class="value">${formatCurrency(dataPoint.netWorth)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Contributions</h4>
            <div class="value">${formatCurrency(dataPoint.totalContributions)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Interest Earned</h4>
            <div class="value">${formatCurrency(dataPoint.interestEarned)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Loan Balance</h4>
            <div class="value">${formatCurrency(dataPoint.loanBalance)}</div>
        </div>
        <div class="summary-overlay-card">
            <h4>Interest Paid</h4>
            <div class="value">${formatCurrency(dataPoint.totalInterestPaid)}</div>
        </div>
    `;
    
    // Don't automatically show the overlay - let user control it with toggle button
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

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    const drawer = document.getElementById('drawer');
    const handle = document.querySelector('.drawer-handle');
    const netWorthModal = document.getElementById('netWorthOverridesModal');
    const chartHeaderModal = document.getElementById('chartHeaderModal');
    const loanDetailModal = document.getElementById('loanDetailModal');
    const addLoanModal = document.getElementById('addLoanModal');
    const summaryOverlay = document.getElementById('summaryOverlay');

    const modalOpen = [netWorthModal, chartHeaderModal, loanDetailModal, addLoanModal].some(
        (modal) => modal && (modal.style.display === 'block' || modal.style.display === 'flex' || modal.classList.contains('is-open'))
    );
    
    // Close drawer when clicking outside drawer and handle (not while a modal is open)
    if (!modalOpen && drawer && handle && !drawer.contains(e.target) && !handle.contains(e.target)) {
        closeDrawer();
    }
    
    // Close net worth modal when clicking outside
    if (netWorthModal && e.target === netWorthModal) {
        closeNetWorthOverrides();
    }
    
    // Close chart header modal when clicking outside
    if (chartHeaderModal && e.target === chartHeaderModal) {
        closeChartHeaderModal();
    }

    if (loanDetailModal && e.target === loanDetailModal) {
        closeLoanDetail();
    }

    if (addLoanModal && e.target === addLoanModal) {
        closeAddLoanForm();
    }
    
    // Close summary overlay when clicking outside
    if (summaryOverlay && e.target === summaryOverlay) {
        closeSummaryOverlay();
    }
});
