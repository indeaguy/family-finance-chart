/**
 * Bottom drawer open/close, window-resize handle repositioning, and the
 * document-level click-outside handler that closes the drawer and modals.
 * Handle animation invariant: the handle's final position is calculated
 * BEFORE the drawer class change and both are set in the same synchronous
 * block with identical transition timing, so the handle appears physically
 * attached to the drawer. Never reposition the handle after transitionend.
 * Defines globals: toggleDrawer, openDrawer, closeDrawer
 * Depends on: folder-sheet.js (updateFolderPocketHeight, resetPencilBelowFold,
 *   playPencilEntranceRoll, resetFolderSheetRaise); summary-overlay.js
 *   (closeSummaryOverlay, closeChartHeaderModal); app.js globals
 *   (closeNetWorthOverrides, closeLoanDetail, closeAddLoanForm);
 *   DOM: #drawer, .drawer-handle, #netWorthOverridesModal, #chartHeaderModal,
 *   #loanDetailModal, #addLoanModal, #summaryOverlay.
 */

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
