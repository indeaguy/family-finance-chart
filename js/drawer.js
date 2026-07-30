/**
 * Bottom drawer open/close, window-resize pocket updates, and the
 * document-level click-outside handler that closes the drawer and modals.
 * Handle attachment invariant: `.drawer-handle` is a child of `#drawer` and
 * sits at `bottom: 100%`, so it rides the drawer's `transform` with no
 * separate position animation. Never animate the handle's bottom/top, and
 * never measure/reposition it on open, close, or transitionend.
 * Defines globals: toggleDrawer, openDrawer, closeDrawer
 * Depends on: folder-sheet.js (updateFolderPocketHeight, resetPencilBelowFold,
 *   resetPencilEntranceSession, playPencilEntranceRoll, resetFolderSheetRaise);
 *   summary-overlay.js
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

    // Lock pocket height before the open animation so contents do not reflow mid-slide
    updateFolderPocketHeight();
    resetPencilBelowFold();

    drawer.classList.add('open');

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

    drawer.classList.remove('open');
    resetPencilEntranceSession();
    resetFolderSheetRaise();
}

// Handle window resize to keep folder pocket height correct while open
window.addEventListener('resize', () => {
    const drawer = document.getElementById('drawer');
    if (drawer && drawer.classList.contains('open')) {
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
