/**
 * Loans/Savings file folder: tab switching, loose-leaf sheet raise on
 * wheel/touch, pocket height sizing, and the decagonal pencil roll.
 * The pencil facet roll must stay 1:1 with paper travel (no-slip).
 * Defines globals: updateFolderPocketHeight, getMaxFolderSheetRaise,
 *   applyFolderSheetRaise, resetFolderSheetRaise, switchFolderSheet,
 *   playPencilEntranceRoll, resetPencilBelowFold, updatePencilForActiveSheet,
 *   handlePencilClick, initFolderSheetRaise
 *   (plus module state: folderSheetRaiseOffset, pencilRollOffset,
 *   pencilEntrancePlayedThisOpen)
 * Depends on: DOM: #drawer, #loansSavingsFolder, .folder-sheet, .folder-tab,
 *   .folder-pocket, .folder-pocket-footer, .pencil-barrel-roll; CSS custom
 *   properties --pencil-facet-cycle, --pencil-facet, --leaf-line,
 *   --folder-pocket-height (see css/folder.css).
 * Called from: drawer.js (on open/close), app.js (resetFolderSheetRaise after
 *   loan list changes).
 */

// Folder sheet tabs (Loans / Savings) — raise loose-leaf only to reveal clipped content
let folderSheetRaiseOffset = 0;
let folderSheetTouchY = null;
let pencilRollOffset = 0;
let pencilEntranceRaf = null;
let pencilEntrancePlayedThisOpen = false;

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

function resetPencilEntranceSession() {
    pencilEntrancePlayedThisOpen = false;
    resetPencilBelowFold();
}

function setPencilRestPosition(folder, footer, drawer) {
    footer.style.transition = 'none';
    footer.style.bottom = '14px';
    footer.classList.add('pencil-on-drawer-floor', 'pencil-above-fold');
    if (drawer && !drawer.classList.contains('sheet-escaping')) {
        drawer.classList.remove('pencil-entering');
    }
}

function updatePencilForActiveSheet(sheetName) {
    const btn = document.getElementById('addLoanPencilBtn');
    const label = btn?.querySelector('.pencil-label');
    if (!btn || !label) return;

    const text = sheetName === 'loans' ? 'Add Loan' : 'Add Savings';
    label.textContent = text;
    btn.title = text;
    btn.setAttribute('aria-label', text);
}

function handlePencilClick() {
    const folder = document.getElementById('loansSavingsFolder');
    const sheet = folder?.dataset.activeSheet || 'savings';
    if (sheet === 'loans') {
        showAddLoanForm();
    } else {
        showAddSavingsForm();
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
    if (!folder || !footer || !drawer) return;

    if (pencilEntrancePlayedThisOpen) {
        setPencilRestPosition(folder, footer, drawer);
        updatePencilForActiveSheet(folder.dataset.activeSheet || 'savings');
        return;
    }

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
            pencilEntrancePlayedThisOpen = true;
            updatePencilForActiveSheet(folder.dataset.activeSheet || 'savings');
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

    updatePencilForActiveSheet(sheetName);
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

document.addEventListener('DOMContentLoaded', () => {
    initFolderSheetRaise();
    const folder = document.getElementById('loansSavingsFolder');
    if (folder) {
        updatePencilForActiveSheet(folder.dataset.activeSheet || 'savings');
    }
});
