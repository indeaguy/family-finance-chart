# Family Finance Chart — Agent File Map

Plain HTML/CSS/JS, no build step. Globals and `onclick` handlers are intentional. Prefer opening **one** file whose header lists its contract; only follow Depends-on links when needed.

## Which file for which task

| Task | Read first |
|------|------------|
| Chart series, markers, hover, resize | `js/chart-manager.js` |
| Compound interest / loan amortization math | `js/calculator.js` |
| Field schema helpers (form/table/export) | `js/field-model.js` |
| Loans/overrides store, JSON import/export, `LOAN_FIELDS` | `js/data-manager.js` |
| Forms, loans list, loan modals, download | `js/ui-manager.js` |
| Field-model / loan schema / remaining-balance unit tests | `tests/field-model.mjs` (`npm run test:unit`) |
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
8. `data-manager.js`
9. `ui-manager.js`
10. `override-manager.js`
11. `app.js`

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

- **`js/calculator.js`** — `FinanceCalculator`: growth, amortization, overrides → chart data; `remainingBalanceAsOf` for single-loan balance through a date.
- **`js/chart-manager.js`** — `ChartManager`: LightweightCharts series and markers.
- **`js/field-model.js`** — Reusable field-schema helpers: filter/format/serialize/hydrate and render form/table/detail from a `*_FIELDS` array. Entity-agnostic; schemas live with their owner store.
- **`js/data-manager.js`** — `DataManager`: loans, overrides, import/export; owns `LOAN_FIELDS` (drives add-loan form, loans table, detail rows, loan JSON shape).
- **`js/ui-manager.js`** — `UIManager`: forms, loans list, loan modals, JSON download (loan UI generated from `LOAN_FIELDS`).
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
| Loan modals | `#addLoanModal`, `#addLoanFormFields`, `#loanDetailModal`, `#loanDetailBody`; loan inputs (`#loanAmount`, etc.) are generated into `#addLoanFormFields` from `LOAN_FIELDS` |
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

## Loose-leaf line grid invariant (load-bearing)

Ruled paper uses a repeating background stepped by `--leaf-line` (28px). Every `.sheet-ruled-row` on that sheet must occupy exactly one step — top offset `n * --leaf-line` from the sheet top.

- Do **not** render the loans list as a `<table>` / `<tr>`: table rows ignore `max-height` and grow (~33px), so text drifts off the blue lines.
- Keep loans as `div.sheet-ruled-row` children inside `.loans-table` (CSS grid columns) in `ui-manager.js` + `css/folder.css`.
- Guard: `npm run test:ui` → `tests/loose-leaf-alignment.mjs` (needs Chrome, or `CHROME_PATH`).

## Handle animation invariants (load-bearing)

The handle must look physically attached to the drawer for the whole open/close animation.

- Never animate the handle *after* the drawer finishes (`setTimeout` / `transitionend` repositioning).
- Never measure DOM mid-animation for handle position.
- Always compute the handle’s final position **before** changing the drawer class, then set handle style and drawer class in the **same synchronous block**.
- Handle and drawer must use identical CSS transition timing/easing.

Implementation lives in `js/drawer.js` with styles in `css/drawer.css`.

## Field schemas (reusable pattern)

- Declare a `*_FIELDS` array on the owner store (loans → `LOAN_FIELDS` in `data-manager.js`).
- Each field: `key`, `label`, `type`, surface flags (`form` / `table` / `detail` / `export` / `import`), optional `domId`, `default`, `formOrder` / `tableOrder` / `detailOrder`, `computed` + `compute(entity, ctx)`, `exportValue`, `display`.
- Computed fields (e.g. loan `remainingBalance` as of today) must not be form/export/import; resolve at render via `compute` and `ctx.calculator`.
- Use `field-model.js` helpers for serialize/hydrate/render — do not hardcode parallel column/form lists in the UI.
- Next entity (savings, overrides, …): add its `*_FIELDS` + wire the same helpers; do not fork loan-only render paths.
- When adding or changing a schema / computed field / export shape: extend `tests/field-model.mjs` (or a sibling unit file) and run `npm run test:unit` before considering the change done.

## Tests (verify changes here)

| Command | What | Needs Chrome |
|---------|------|--------------|
| `npm run test:unit` | `tests/field-model.mjs` — field-model helpers, `LOAN_FIELDS` surfaces/order, serialize/hydrate, `remainingBalanceAsOf`, form render | No |
| `npm run test:ui` | `tests/loose-leaf-alignment.mjs` — loans loose-leaf row grid | Yes (`CHROME_PATH` if needed) |
| `npm test` | Both suites via `tests/run.mjs` | Yes (for the UI suite) |

**When to run what**

- Changing `js/field-model.js`, `LOAN_FIELDS`, loan JSON import/export, or `remainingBalanceAsOf` → **must** pass `npm run test:unit` (prefer full `npm test`).
- Changing loans table markup/CSS, folder loose-leaf rows, or `updateLoansList` layout → **must** pass `npm run test:ui`.
- Adding a new `*_FIELDS` entity → add assertions (surfaces, export keys, computed flags) alongside the schema; wire the new file into `tests/run.mjs` if it is a separate suite.
- Shared loader for classic scripts in Node: `tests/helpers/load-browser-scripts.mjs`.

Do not land field-schema or amortization changes that fail the unit suite; do not land loans-list layout changes that fail the UI suite.

## Development notes

- No bundler: add a new script with a `<script>` tag in the order above; put a Defines/Depends header at the top.
- Prefer extending an existing file over inventing a new module unless the concern is clearly new.
- Keep backward compatibility for old JSON override shapes (`data-manager.js` / `calculator.js`).
- Example scenarios: `example.json` and `example-*.json` in the repo root.
- After substantive edits, run the matching tests above (`npm test` when unsure).
