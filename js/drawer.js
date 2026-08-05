/**
 * Bottom drawer open/close, window-resize pocket updates, and the
 * document-level click-outside handler that closes the drawer and modals.
 * Handle attachment invariant: `.drawer-handle` is a child of `#drawer` and
 * sits at `bottom: 100%`, so it rides the drawer's `transform` with no
 * separate position animation. Never animate the handle's bottom/top, and
 * never measure/reposition it on open, close, or transitionend.
 * Defines globals: toggleDrawer, openDrawer, closeDrawer
 * Desk pencil roll: tracks live drawer translateY while opening or closing,
 * then coasts with decaying velocity after the drawer stops (momentum).
 * Tune via DESK_PENCIL.
 * Depends on: folder-sheet.js (updateFolderPocketHeight, resetPencilBelowFold,
 *   resetPencilEntranceSession, playPencilEntranceRoll, resetFolderSheetRaise);
 *   summary-overlay.js
 *   (closeSummaryOverlay, closeChartHeaderModal); app.js globals
 *   (closeNetWorthOverrides, closeLoanDetail, closeAddLoanForm, closeSavingsDetail,
 *   closeAddSavingsForm);
 *   DOM: #drawer, .drawer-handle, .pencil, .pencil-barrel-roll,
 *   #netWorthOverridesModal, #chartHeaderModal, #loanDetailModal,
 *   #addLoanModal, #savingsDetailModal, #addSavingsModal, #summaryOverlay.
 */

/** Must stay in sync with `.drawer-container { transition: transform … }` */
const DRAWER_OPEN_MS = 400;

/**
 * Desk pencil roll — tweak these, reload, open/close the drawer.
 *
 * Facets always track the pencil's own path (no-slip). Drawer speed sets how
 * fast that path grows; after stop, path coasts then eases out.
 *
 * openSlipScale          Pencil path px per drawer-travel px while opening.
 * closeSlipScale         Same while closing (rolls up from inertia).
 * facetPerMotionPx       Barrel spin vs pencil path (1 = no-slip, <1 = slower spin).
 * momentumMs             How long after the drawer stops before the pencil fully stops.
 * momentumEasePower      Deceleration after stop: 1 linear, ~2 gentle, ~3 stronger.
 * momentumDistanceScale  Scales coast distance derived from handoff speed (1 = natural).
 * startAngleDeg          Barrel tilt during open tracking.
 * endAngleDeg            Barrel tilt when open momentum finishes / during close.
 */
const DESK_PENCIL = {
    openSlipScale: 0.12,
    closeSlipScale: 0.12,
    facetPerMotionPx: 1,
    momentumMs: 520,
    momentumEasePower: 2.4,
    momentumDistanceScale: 1,
    startAngleDeg: -24,
    endAngleDeg: -32,
};

let deskPencilMomentumRaf = null;
/** @type {null | { mode: 'open' | 'close', handoff: () => void, id: symbol }} */
let deskPencilRollSession = null;

function easeDeskPencilResistance(t, power) {
    const p = Math.max(1, power);
    return 1 - Math.pow(1 - t, p);
}

function getDrawerTranslateY(drawer) {
    const t = getComputedStyle(drawer).transform;
    if (!t || t === 'none') return 0;
    return new DOMMatrixReadOnly(t).m42;
}

function getDeskPencilRollDir(angleDeg) {
    const axisRad = (angleDeg * Math.PI) / 180;
    const axisX = Math.cos(axisRad);
    const axisY = Math.sin(axisRad);
    // +90° CW from barrel axis (CSS y+ down)
    let dirX = axisY;
    let dirY = -axisX;
    if (dirY > 0) {
        dirX = -dirX;
        dirY = -dirY;
    }
    return { dirX, dirY };
}

function setDeskPencilPose(pencil, roll, x, y, angleDeg, facetPx) {
    pencil.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angleDeg}deg)`;
    if (roll) {
        roll.style.backgroundPosition = `0 ${-facetPx}px`;
    }
}

function resetDeskPencilMomentum() {
    if (deskPencilMomentumRaf) {
        cancelAnimationFrame(deskPencilMomentumRaf);
        deskPencilMomentumRaf = null;
    }
    deskPencilRollSession = null;
    const pencil = document.querySelector('#drawer .pencil');
    const roll = pencil?.querySelector('.pencil-barrel-roll');
    if (pencil) {
        pencil.style.transform = '';
    }
    if (roll) {
        roll.style.backgroundPosition = '';
    }
}

function readDeskPencilFacetTravel(roll, facetPerMotionPx) {
    if (!roll) return 0;
    const yPart = (roll.style.backgroundPosition || '0 0').trim().split(/\s+/)[1] || '0';
    const px = parseFloat(yPart);
    if (!Number.isFinite(px) || !facetPerMotionPx) return 0;
    return Math.abs(px) / facetPerMotionPx;
}

/**
 * Track drawer motion and roll the desk pencil.
 * mode 'open': slips/lags as the drawer rises, then coasts back toward rest.
 * mode 'close': rolls up as the drawer drops (inertia), then coasts further up.
 */
function startDeskPencilRollTracking(drawer, mode = 'open') {
    const pencil = drawer?.querySelector('.pencil');
    const roll = pencil?.querySelector('.pencil-barrel-roll');
    if (!drawer || !pencil) return;

    if (deskPencilMomentumRaf) {
        cancelAnimationFrame(deskPencilMomentumRaf);
        deskPencilMomentumRaf = null;
    }

    const {
        openSlipScale,
        closeSlipScale,
        facetPerMotionPx,
        momentumMs,
        momentumEasePower,
        momentumDistanceScale,
        startAngleDeg,
        endAngleDeg,
    } = DESK_PENCIL;

    const slipScale = mode === 'close' ? closeSlipScale : openSlipScale;
    const angleDuringTrack = mode === 'close' ? endAngleDeg : startAngleDeg;
    const { dirX, dirY } = getDeskPencilRollDir(angleDuringTrack);
    const sessionId = Symbol(mode);

    let phase = 'tracking';
    let prevY = getDrawerTranslateY(drawer);
    let prevT = performance.now();
    // Open: lag along -dir (left behind). Close: lift along +dir (rolls up).
    let offset = 0;
    let facetTravel = mode === 'close'
        ? readDeskPencilFacetTravel(roll, facetPerMotionPx)
        : 0;
    let lastSpeed = 0;
    let coast = null;

    const poseFromOffset = (offsetPx, facetPx, angleDeg) => {
        // open lag uses -dir; close lift uses +dir
        const sign = mode === 'close' ? 1 : -1;
        setDeskPencilPose(
            pencil,
            roll,
            sign * dirX * offsetPx,
            sign * dirY * offsetPx,
            angleDeg,
            facetPx * facetPerMotionPx
        );
    };

    poseFromOffset(0, facetTravel, angleDuringTrack);

    const step = (now) => {
        if (deskPencilRollSession?.id !== sessionId) {
            return;
        }

        if (phase === 'tracking') {
            const y = getDrawerTranslateY(drawer);
            const dt = Math.max(1, now - prevT);
            // open: translateY decreases; close: translateY increases
            const drawerTravel = mode === 'close' ? y - prevY : prevY - y;
            if (drawerTravel > 0) {
                const motion = drawerTravel * slipScale;
                lastSpeed = motion / dt;
                offset += motion;
                facetTravel += motion;
            }
            prevY = y;
            prevT = now;
            poseFromOffset(offset, facetTravel, angleDuringTrack);
            deskPencilMomentumRaf = requestAnimationFrame(step);
            return;
        }

        const u = Math.min(1, (now - coast.t0) / coast.durationMs);
        const eased = easeDeskPencilResistance(u, coast.easePower);
        const offsetNow = coast.offset0 + (coast.endOffset - coast.offset0) * eased;
        const facetNow = coast.facet0 + Math.abs(offsetNow - coast.offset0);
        const angle = mode === 'close'
            ? endAngleDeg
            : startAngleDeg + (endAngleDeg - startAngleDeg) * eased;
        poseFromOffset(offsetNow, facetNow, angle);
        if (u < 1) {
            deskPencilMomentumRaf = requestAnimationFrame(step);
        } else {
            deskPencilMomentumRaf = null;
            if (deskPencilRollSession?.id === sessionId) {
                deskPencilRollSession = null;
            }
            poseFromOffset(
                coast.endOffset,
                coast.facet0 + Math.abs(coast.endOffset - coast.offset0),
                mode === 'close' ? endAngleDeg : endAngleDeg
            );
            // Close finish: drawer is off-screen — clear inline pose for next open
            if (mode === 'close') {
                pencil.style.transform = '';
                if (roll) roll.style.backgroundPosition = '';
            }
        }
    };

    deskPencilRollSession = {
        mode,
        id: sessionId,
        handoff() {
            if (phase !== 'tracking') return;
            phase = 'coasting';

            const drawerHeight = drawer.getBoundingClientRect().height;
            const v0 = Math.max(
                lastSpeed,
                (drawerHeight / DRAWER_OPEN_MS) * slipScale * 0.08
            );

            const T = Math.max(1, momentumMs);
            const p = Math.max(1, momentumEasePower);
            const coastDist = v0 * T * momentumDistanceScale / p;

            // open: coast back toward rest (offset → 0)
            // close: keep rolling up (offset grows)
            const endOffset = mode === 'close'
                ? offset + coastDist
                : Math.max(0, offset - coastDist);

            coast = {
                t0: performance.now(),
                offset0: offset,
                endOffset,
                facet0: facetTravel,
                durationMs: T,
                easePower: p,
            };
        },
    };

    deskPencilMomentumRaf = requestAnimationFrame(step);
}

/** Call when the drawer transform finishes — switches tracking → momentum coast. */
function handoffDeskPencilMomentum() {
    deskPencilRollSession?.handoff();
}

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
    resetDeskPencilMomentum();

    drawer.classList.add('open');
    // Track live drawer speed immediately so the pencil rolls with the open
    startDeskPencilRollTracking(drawer, 'open');

    let pencilEntranceStarted = false;
    const startPencilEntrance = () => {
        if (pencilEntranceStarted || !drawer.classList.contains('open')) return;
        if (deskPencilRollSession?.mode !== 'open') return;
        pencilEntranceStarted = true;
        drawer.removeEventListener('transitionend', onDrawerOpened);
        // Drawer stopped — pencil keeps rolling briefly, then eases out
        handoffDeskPencilMomentum();
        playPencilEntranceRoll();
    };
    const onDrawerOpened = (e) => {
        if (e.target !== drawer || e.propertyName !== 'transform') return;
        startPencilEntrance();
    };
    drawer.addEventListener('transitionend', onDrawerOpened);
    // Fallback if transitionend does not fire (matches DRAWER_OPEN_MS)
    setTimeout(startPencilEntrance, DRAWER_OPEN_MS + 50);
}

function closeDrawer() {
    const drawer = document.getElementById('drawer');
    if (!drawer.classList.contains('open')) return;

    // Keep the pencil live: roll up with the closing slide, then momentum-coast
    if (deskPencilMomentumRaf) {
        cancelAnimationFrame(deskPencilMomentumRaf);
        deskPencilMomentumRaf = null;
    }
    deskPencilRollSession = null;

    drawer.classList.remove('open');
    resetPencilEntranceSession();
    resetFolderSheetRaise();

    startDeskPencilRollTracking(drawer, 'close');

    let closeHandoffDone = false;
    const finishClosePencil = (e) => {
        if (closeHandoffDone) return;
        if (e && (e.target !== drawer || e.propertyName !== 'transform')) return;
        if (deskPencilRollSession?.mode !== 'close') return;
        closeHandoffDone = true;
        drawer.removeEventListener('transitionend', finishClosePencil);
        handoffDeskPencilMomentum();
    };
    drawer.addEventListener('transitionend', finishClosePencil);
    setTimeout(finishClosePencil, DRAWER_OPEN_MS + 50);
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
    const savingsDetailModal = document.getElementById('savingsDetailModal');
    const addSavingsModal = document.getElementById('addSavingsModal');
    const summaryOverlay = document.getElementById('summaryOverlay');

    const modalOpen = [netWorthModal, chartHeaderModal, loanDetailModal, addLoanModal, savingsDetailModal, addSavingsModal].some(
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

    if (savingsDetailModal && e.target === savingsDetailModal) {
        closeSavingsDetail();
    }

    if (addSavingsModal && e.target === addSavingsModal) {
        closeAddSavingsForm();
    }
    
    // Close summary overlay when clicking outside
    if (summaryOverlay && e.target === summaryOverlay) {
        closeSummaryOverlay();
    }
});
