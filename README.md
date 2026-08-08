# Family Finance Chart

A simple web application to visualize financial growth over time, including compound interest, savings, and loan calculations.

## Features

- **Multi-account Savings**: Add savings accounts with their own balances, contributions, and rates
- **Compound Interest**: Each account grows independently; totals sum into Total Savings
- **Optional End Dates**: Accounts with an end date freeze at that balance but still count toward the total afterward
- **Loan Management**: Add multiple loans with different terms and rates
- **Interactive Charts**: Powered by TradingView's Lightweight Charts library
- **Real-time Updates**: Charts update as you add or remove accounts and loans
- **Financial Summary**: Key metrics displayed in easy-to-read cards
- **JSON Import/Export**: Save and load financial scenarios

## How to Use

### Basic Usage
1. Open `index.html` in your web browser
2. Open the drawer and use the green **Savings** folder tab:
   - Click the rolling pencil **Add Savings** button to open the loose-leaf form
   - Fields: name, initial amount, monthly contribution, interest rate, start date, optional end date, and whether it counts toward Total Savings
   - Uncheck **Include in Total Savings** for earmarked spend (vacation, gifts) — the line still charts, but stays out of the total
   - Active savings fill the sheet as ruled rows — click a row to open its **account card** (details; **Edit** to change fields, then **Remove** with confirm) beside the drawer control-group left of the folder; excluded accounts show `(excl.)` in the name
3. Switch to the manila **Loans** folder tab:
   - Pencil becomes **Add Loan**; active loans use the same ruled-row sheet pattern; click a row for that loan’s account card (Edit / confirmed Remove, same left-of-folder placement)
   - Scroll over the folder to raise the loose-leaf when rows are clipped

4. The chart will show multiple lines:
   - **Teal dotted**: Individual savings accounts (sum to Total Savings)
   - **Green**: Total Savings
   - **Blue**: Net Worth (savings minus loan balances)
   - **Red dotted / solid**: Individual loans and Total Loan Balance
   - **Orange Dashed**: Goal line (if goal amount is set in imported JSON)

### JSON Import/Export

#### Save Your Configuration
- Click **📤 Export to JSON** to download your current setup
- File saves as `family-finance-YYYY-MM-DD.json`

#### Load a Configuration
- Click **📥 Import JSON** to select and load a saved file
- All settings and loans will be restored

#### Try the Example
- With no import yet, the app loads demo savings accounts and loans from `js/default_config/example-default-loans.js`
- Older JSON files that still use a single `savings.initialAmount` / `monthlySavings` / `interestRate` block are imported as one savings account
- Import `example.json` for a sample scenario (legacy singular savings + three loans)

## Chart Features

- **Interactive Hover**: Move cursor over chart lines to see values at specific points in time
- **Goal Visualization**: Horizontal goal line with achievement marker
- **Time Formatting**: Displays time in "X years, Y months" format
- **Zoom and pan** to explore different time periods
- **Responsive design** works on desktop and mobile

## Technical Details

- Uses TradingView's Lightweight Charts library for professional-grade charting
- Pure HTML/CSS/JavaScript — no build process required; open `index.html` directly
- Styles split by concern under `css/`: `base.css`, `drawer.css`, `folder.css`, `overlays.css`
- Scripts under `js/`: UI helpers (`format.js`, `folder-sheet.js`, `drawer.js`, `summary-overlay.js`) plus core modules (`calculator.js`, `chart-manager.js`, `field-model.js`, `data-manager.js`, `ui-manager.js`, `override-manager.js`, `app.js`)
- Calculations include compound interest and loan amortization schedules
- Real-time updates with input debouncing for smooth performance
- JSON-based configuration system for saving/loading scenarios
- See `AGENTS.md` for the file map, load order, and DOM ownership (useful when editing)

## Getting Started

Simply open `index.html` in any modern web browser. No server or installation required!

Try importing `example.json` to see a realistic financial scenario in action.

## Tests

```bash
npm install
npm test              # unit + UI suites
npm run test:unit     # field-model / LOAN_FIELDS / remaining balance (no Chrome)
npm run test:ui       # loose-leaf row alignment (needs Chrome)
```

- **Unit** (`tests/field-model.mjs`): field-schema helpers, loan surface/order, JSON serialize/hydrate, `remainingBalanceAsOf`.
- **UI** (`tests/loose-leaf-alignment.mjs`): every Loans loose-leaf `.sheet-ruled-row` sits on the `--leaf-line` grid (prevents table-row height drift). Set `CHROME_PATH` if Chrome is not at the macOS default location.

See `AGENTS.md` → **Tests** for when to run which suite after a change.
