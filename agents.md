# Family Finance Chart — Agent File Map

Plain HTML/CSS/JS, no build step. Globals and `onclick` handlers are intentional. Prefer opening **one** file whose header lists its contract; only follow Depends-on links when needed.

## Which file for which task

| Task | Read first |
|------|------------|
| Chart series, markers, hover, resize | `js/chart-manager.js` |
| Compound interest / loan amortization math | `js/calculator.js` |
| Field schema helpers (form/table/export) | `js/field-model.js` |
| Default demo loans + savings (no user import) | `js/default_config/` |
| Loans/savings/overrides store, JSON import/export, `LOAN_FIELDS` / `SAVINGS_FIELDS` | `js/data-manager.js` |
| Forms, loans/savings lists, loan/savings modals, download | `js/ui-manager.js` |
| Field-model / loan+savings schema / balance-as-of unit tests | `tests/field-model.mjs` (`npm run test:unit`) |
| Loose-leaf line/text alignment regression | `tests/loose-leaf-alignment.mjs` (`npm run test:ui`) |
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
7. `field-model.js`
8. `default_config/example-default-loans.js` (sets `DEFAULT_EXAMPLE_DATA`)
9. `data-manager.js`
10. `ui-manager.js`
11. `override-manager.js`
12. `app.js`

Cross-file calls happen at event time, not load time, except that `app.js` must load last so classes exist when `FinanceApp` constructs.

## File inventory

### Markup & styles

- **`index.html`** — Structure only (~270 lines). Links CSS/JS; keeps the LightweightCharts load-failure check inline in `<head>`.
- **`css/base.css`** — Body, `.main-container`, chart container/header/overlay, general mobile rules.
- **`css/drawer.css`** — Drawer handle, container, wood interior, control groups, desk objects in `.drawer-desk-layer` (stubby pencil pose/roll driven by `drawer.js`), close button.
- **`css/folder.css`** — File folder, tabs, pocket, loose-leaf, Add Loan pencil roll, shared `.pencil-*` part styles, loans table.
- **`css/overlays.css`** — Summary overlay, modals, floating loose-leaf sheets, chart-header modal.

### UI globals (former `utilities.js`)

- **`js/format.js`** — `formatCurrency`, `formatTimeDisplay`, `updateChart` shim → `window.app`.
- **`js/folder-sheet.js`** — Folder tabs, sheet raise, pocket height, pencil entrance/roll.
- **`js/drawer.js`** — `toggleDrawer` / `openDrawer` / `closeDrawer`; desk pencil rolls with live drawer open/close speed then momentum-coasts after each stop (`DESK_PENCIL` tunables); folder pencil entrance; resize pocket update; click-outside closes drawer + modals. Handle is a nested child (no separate position sync).
- **`js/summary-overlay.js`** — Summary overlay + chart-header modal + `showChartHover`.

### Core app modules

- **`js/calculator.js`** — `FinanceCalculator`: multi-account savings growth (end-date freeze), loan amortization, overrides → chart data; `remainingBalanceAsOf` / `savingsBalanceAsOf` for single-entity balance through a date. Total Savings = sum of account balances (loan payments do not reduce savings).
- **`js/chart-manager.js`** — `ChartManager`: LightweightCharts series and markers; total savings + per-account savings lines (`INDIVIDUAL_SAVINGS_LINES`), total loan balance + per-loan lines (`INDIVIDUAL_LOAN_LINES`); hover right-axis labels are stacked DOM rows (`title` + amount + interest; savings → earned, loans → paid). **`setDetailFocus`** dims non-focused series while floating read-only detail panels are open and filters Y-axis hover labels to those series only.
- **`js/field-model.js`** — Reusable field-schema helpers: filter/format/serialize/hydrate and render form/table/detail from a `*_FIELDS` array. Entity-agnostic; schemas live with their owner store.
- **`js/default_config/example-default-loans.js`** — `DEFAULT_EXAMPLE_DATA` demo loans + savings accounts applied on load when the user has not imported JSON (script tag; works with `file://`).
- **`js/data-manager.js`** — `DataManager`: loans, savings accounts, overrides, import/export; owns `LOAN_FIELDS` and `SAVINGS_FIELDS`; applies `DEFAULT_EXAMPLE_DATA` via `loadDefaultExampleIfNeeded()`. Legacy singular `savings.initialAmount` / `monthlySavings` / `interestRate` imports become one account.
- **`js/ui-manager.js`** — `UIManager`: forms, loans/savings lists, add modals, floating read-only detail panels (cloned from `#floatingDetailPanelTemplate` into `#floatingDetailPanelsRoot`), JSON download (UI generated from `*_FIELDS`).
- **`js/override-manager.js`** — `OverrideManager`: dual savings + loan-balance overrides.
- **`js/app.js`** — `FinanceApp` + onclick globals; dependency injection hub.

## DOM id ownership

| Owner | Ids / regions |
|-------|----------------|
| Drawer | `#drawer`, `#drawerTopRef`, `.drawer-handle`, `.drawer-desk-layer` (pencil/pin/eraser) |
| Folder | `#loansSavingsFolder`, `#folderSheetLoans`, `#folderSheetSavings`, `#loansList`, `#savingsList`, `#addLoanPencilBtn` |
| Projection (hidden) | `#startDate`, `#timePeriod`, `#goalAmount` — chart timeline; former Savings & Interest form shell left in place without visible fields |
| Chart | `#chart`, `#chartOverlay`, `.chart-header` |
| Summary | `#summaryOverlay`, `#summaryOverlayContent` |
| Loan modals | `#addLoanModal`, `#addLoanFormFields`; loan inputs (`#loanAmount`, etc.) are generated into `#addLoanFormFields` from `LOAN_FIELDS` |
| Loan/savings detail panels | `#floatingDetailPanelsRoot`, `#floatingDetailPanelTemplate` — dynamic `.floating-detail-panel` instances (read-only; one per entity; staggered on chart right side) |
| Savings modals | `#addSavingsModal`, `#addSavingsFormFields`; savings inputs generated from `SAVINGS_FIELDS` |
| Overrides | `#netWorthOverridesModal`, `#netWorthOverridesList`, `#overrideDate`, `#overrideSavings`, `#overrideLoanBalance` |
| Chart header modal | `#chartHeaderModal`, `#chartTitle`, `#chartSubtitle`, `#chartHeaderBg`, `#chartHeaderPos`, `#chartHeaderVisible` |
| Import | `#jsonFileInput` |

## Known cross-component seams

Do not “fix” these in drive-by refactors; document and keep in sync:

1. **`updateSummaryOverlay`** (`summary-overlay.js`) prefers `window.app.calculator.calculateFinancialGrowth()` so multi-account totals stay aligned with the chart.
2. **`app.js`** calls global **`resetFolderSheetRaise()`** after loan or savings list changes so the folder pocket stays correct.
3. **`chart-manager.js`** calls **`window.showChartHover`** (from `summary-overlay.js`) on crosshair move.
4. **`drawer.js`** click-outside handler closes drawer, summary overlay, chart-header modal, add loan/savings modals, and overrides (via `app.js` globals). Floating read-only detail panels do **not** block drawer close or use a backdrop.
5. **`UIManager.openDetailPanels`** → **`ChartManager.setDetailFocus`** keeps chart emphasis and Y-axis hover labels aligned with open detail sheets.
6. **`UIManager.formatCurrency`** is separate from the global `formatCurrency` in `format.js` — same idea, two call sites.
7. **Savings end date:** after `endMonth` / `endDate`, an account freezes at that month’s balance but still adds that frozen value to Total Savings for the rest of the chart (when `includeInTotal` is true).
8. **Savings `includeInTotal`:** when false, the account still gets its own chart line but is omitted from Total Savings / net worth (earmarked spend such as vacation).

## Loose-leaf line grid invariant (load-bearing)

Ruled paper uses a repeating background stepped by `--leaf-line` (28px). Every `.sheet-ruled-row` on that sheet must occupy exactly one step — top offset `n * --leaf-line` from the sheet top.

- Do **not** render the loans or savings lists as a `<table>` / `<tr>`: table rows ignore `max-height` and grow (~33px), so text drifts off the blue lines.
- Keep loans and savings as `div.sheet-ruled-row` children inside `.loans-table` (CSS grid columns) in `ui-manager.js` + `css/folder.css`.
- Guard: `npm run test:ui` → `tests/loose-leaf-alignment.mjs` (needs Chrome, or `CHROME_PATH`).

## Handle animation invariants (load-bearing)

The handle must look physically attached to the drawer for the whole open/close animation.

- Keep `.drawer-handle` as a **child** of `#drawer`, positioned at `bottom: 100%` (with a small lip tuck). It rides the drawer’s `transform` — do not animate handle `bottom`/`top` separately.
- Never measure or reposition the handle on open/close/resize/`transitionend`.
- `.drawer-container` must stay `overflow: visible` so the nested handle can stick above the lip; clip scrolling on `.drawer-interior` instead.

Implementation lives in `js/drawer.js` with styles in `css/drawer.css`.

## Field schemas (reusable pattern)

- Declare a `*_FIELDS` array on the owner store (`LOAN_FIELDS` / `SAVINGS_FIELDS` in `data-manager.js`).
- Each field: `key`, `label`, `type`, surface flags (`form` / `table` / `detail` / `export` / `import`), optional `domId`, `default`, `formOrder` / `tableOrder` / `detailOrder`, `computed` + `compute(entity, ctx)`, `exportValue`, `display`.
- Computed fields (e.g. loan `remainingBalance`, savings `currentBalance` as of today) must not be form/export/import; resolve at render via `compute` and `ctx.calculator`.
- Use `field-model.js` helpers for serialize/hydrate/render — do not hardcode parallel column/form lists in the UI.
- Next entity (overrides, …): add its `*_FIELDS` + wire the same helpers; do not fork entity-only render paths.
- When adding or changing a schema / computed field / export shape: extend `tests/field-model.mjs` (or a sibling unit file) and run `npm run test:unit` before considering the change done.

## Tests (verify changes here)

| Command | What | Needs Chrome |
|---------|------|--------------|
| `npm run test:unit` | `tests/field-model.mjs` — field-model helpers, `LOAN_FIELDS` / `SAVINGS_FIELDS` surfaces/order, serialize/hydrate, `remainingBalanceAsOf`, `savingsBalanceAsOf`, form render | No |
| `npm run test:ui` | `tests/loose-leaf-alignment.mjs` — loans loose-leaf row grid | Yes (`CHROME_PATH` if needed) |
| `npm test` | Both suites via `tests/run.mjs` | Yes (for the UI suite) |

**When to run what**

- Changing `js/field-model.js`, `LOAN_FIELDS` / `SAVINGS_FIELDS`, loan/savings JSON import/export, `remainingBalanceAsOf`, or `savingsBalanceAsOf` → **must** pass `npm run test:unit` (prefer full `npm test`).
- Changing loans/savings table markup/CSS, folder loose-leaf rows, or `updateLoansList` / `updateSavingsList` layout → **must** pass `npm run test:ui`.
- Adding a new `*_FIELDS` entity → add assertions (surfaces, export keys, computed flags) alongside the schema; wire the new file into `tests/run.mjs` if it is a separate suite.
- Shared loader for classic scripts in Node: `tests/helpers/load-browser-scripts.mjs`.

Do not land field-schema or amortization/savings-growth changes that fail the unit suite; do not land loans/savings-list layout changes that fail the UI suite.

## Development notes

- No bundler: add a new script with a `<script>` tag in the order above; put a Defines/Depends header at the top.
- Prefer extending an existing file over inventing a new module unless the concern is clearly new.
- Keep backward compatibility for old JSON override shapes (`data-manager.js` / `calculator.js`).
- Example scenarios: `example.json` and `example-*.json` in the repo root.
- Default loans + savings (no user import yet): `js/default_config/example-default-loans.js` → `DEFAULT_EXAMPLE_DATA`, applied by `DataManager.loadDefaultExampleIfNeeded()` after calculator injection. Import sets `hasUserImport` so user JSON wins.
- After substantive edits, run the matching tests above (`npm test` when unsure).
