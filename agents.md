# Family Finance Chart — Agent File Map

Plain HTML/CSS/JS, no build step. Globals and `onclick` handlers are intentional. Prefer opening **one** file whose header lists its contract; only follow Depends-on links when needed.

## Which file for which task

| Task | Read first |
|------|------------|
| Chart series, markers, hover, resize | `js/chart-manager.js` |
| Compound interest / loan amortization math | `js/calculator.js` |
| Loans/overrides store, JSON import/export | `js/data-manager.js` |
| Forms, loans table, loan modals, download | `js/ui-manager.js` |
| Net-worth override modal | `js/override-manager.js` |
| Wire-up, lifecycle, HTML onclick globals | `js/app.js` |
| Drawer open/close + handle animation | `js/drawer.js` + `css/drawer.css` |
| Folder tabs, sheet raise, pencil roll | `js/folder-sheet.js` + `css/folder.css` |
| Summary overlay, chart-header modal | `js/summary-overlay.js` + `css/overlays.css` |
| Currency / time formatting, `updateChart()` shim | `js/format.js` |
| Markup / script & stylesheet links | `index.html` |
| Page/chart layout, responsive base | `css/base.css` |

Each `js/*.js` file starts with a purpose / Defines / Depends header. Trust those over this map when they disagree.

## Load order (required)

**CSS** (in `index.html`):

1. `css/base.css`
2. `css/drawer.css`
3. `css/folder.css`
4. `css/overlays.css`

**JS**:

1. `format.js`
2. `folder-sheet.js`
3. `drawer.js`
4. `summary-overlay.js`
5. `calculator.js`
6. `chart-manager.js`
7. `data-manager.js`
8. `ui-manager.js`
9. `override-manager.js`
10. `app.js`

Cross-file calls happen at event time, not load time, except that `app.js` must load last so classes exist when `FinanceApp` constructs.

## File inventory

### Markup & styles

- **`index.html`** — Structure only (~270 lines). Links CSS/JS; keeps the LightweightCharts load-failure check inline in `<head>`.
- **`css/base.css`** — Body, `.main-container`, chart container/header/overlay, general mobile rules.
- **`css/drawer.css`** — Drawer handle, container, wood interior, control groups, desk objects, close button.
- **`css/folder.css`** — File folder, tabs, pocket, loose-leaf, pencil roll, loans table.
- **`css/overlays.css`** — Summary overlay, modals, floating loose-leaf sheets, chart-header modal.

### UI globals (former `utilities.js`)

- **`js/format.js`** — `formatCurrency`, `formatTimeDisplay`, `updateChart` shim → `window.app`.
- **`js/folder-sheet.js`** — Folder tabs, sheet raise, pocket height, pencil entrance/roll.
- **`js/drawer.js`** — `toggleDrawer` / `openDrawer` / `closeDrawer`; resize; click-outside closes drawer + modals.
- **`js/summary-overlay.js`** — Summary overlay + chart-header modal + `showChartHover`.

### Core app modules

- **`js/calculator.js`** — `FinanceCalculator`: growth, amortization, overrides → chart data.
- **`js/chart-manager.js`** — `ChartManager`: LightweightCharts series and markers.
- **`js/data-manager.js`** — `DataManager`: loans, overrides, import/export.
- **`js/ui-manager.js`** — `UIManager`: forms, loans list, loan modals, JSON download.
- **`js/override-manager.js`** — `OverrideManager`: dual savings + loan-balance overrides.
- **`js/app.js`** — `FinanceApp` + onclick globals; dependency injection hub.

## DOM id ownership

| Owner | Ids / regions |
|-------|----------------|
| Drawer | `#drawer`, `#drawerTopRef`, `.drawer-handle` |
| Folder | `#loansSavingsFolder`, `#folderSheetLoans`, `#folderSheetSavings`, `#loansList`, `#addLoanPencilBtn` |
| Savings form | `#startDate`, `#initialAmount`, `#monthlySavings`, `#interestRate`, `#timePeriod`, `#goalAmount` |
| Chart | `#chart`, `#chartOverlay`, `.chart-header` |
| Summary | `#summaryOverlay`, `#summaryOverlayContent` |
| Loan modals | `#addLoanModal`, `#loanDetailModal`, `#loanDetailBody`, loan form fields |
| Overrides | `#netWorthOverridesModal`, `#netWorthOverridesList`, `#overrideDate`, `#overrideSavings`, `#overrideLoanBalance` |
| Chart header modal | `#chartHeaderModal`, `#chartTitle`, `#chartSubtitle`, `#chartHeaderBg`, `#chartHeaderPos`, `#chartHeaderVisible` |
| Import | `#jsonFileInput` |

## Known cross-component seams

Do not “fix” these in drive-by refactors; document and keep in sync:

1. **`updateSummaryOverlay`** (`summary-overlay.js`) duplicates compound-interest math from `calculator.js` and reads `window.app.dataManager` for loan totals. Formula changes need both places.
2. **`app.js`** calls global **`resetFolderSheetRaise()`** after loan list changes so the folder pocket stays correct.
3. **`chart-manager.js`** calls **`window.showChartHover`** (from `summary-overlay.js`) on crosshair move.
4. **`drawer.js`** click-outside handler closes drawer, summary overlay, chart-header modal, loan modals, and overrides (via `app.js` globals).
5. **`UIManager.formatCurrency`** is separate from the global `formatCurrency` in `format.js` — same idea, two call sites.

## Handle animation invariants (load-bearing)

The handle must look physically attached to the drawer for the whole open/close animation.

- Never animate the handle *after* the drawer finishes (`setTimeout` / `transitionend` repositioning).
- Never measure DOM mid-animation for handle position.
- Always compute the handle’s final position **before** changing the drawer class, then set handle style and drawer class in the **same synchronous block**.
- Handle and drawer must use identical CSS transition timing/easing.

Implementation lives in `js/drawer.js` with styles in `css/drawer.css`.

## Development notes

- No bundler: add a new script with a `<script>` tag in the order above; put a Defines/Depends header at the top.
- Prefer extending an existing file over inventing a new module unless the concern is clearly new.
- Keep backward compatibility for old JSON override shapes (`data-manager.js` / `calculator.js`).
- Example scenarios: `example.json` and `example-*.json` in the repo root.
